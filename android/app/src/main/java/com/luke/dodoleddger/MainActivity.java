package com.luke.dodoleddger;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

// 新增安裝 APK 與 Capacitor 插件所需的類別
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.os.Build;
import android.provider.Settings;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "DodoLedger_HotUpdate";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 註冊自訂的原生安裝插件
        registerPlugin(DodoInstallerPlugin.class);
        super.onCreate(savedInstanceState);
        
        try {
            // 0. 🔍 雙重保險：偵測 APK 覆蓋安裝或首次安裝，若有新版 APK 則清理舊熱更新沙盒
            int currentVersionCode = 0;
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                    currentVersionCode = (int) this.getPackageManager().getPackageInfo(this.getPackageName(), 0).getLongVersionCode();
                } else {
                    currentVersionCode = this.getPackageManager().getPackageInfo(this.getPackageName(), 0).versionCode;
                }
            } catch (Exception e) {
                Log.e(TAG, "無法取得當前 APK versionCode", e);
            }

            SharedPreferences prefs = this.getSharedPreferences("dodo_app_prefs", Context.MODE_PRIVATE);
            int lastVersionCode = prefs.getInt("last_apk_version_code", 0);

            if (currentVersionCode > lastVersionCode) {
                Log.d(TAG, "🐱 偵測到 APK 覆蓋安裝或首次啟動 (舊版本: " + lastVersionCode + ", 新版本: " + currentVersionCode + ")，主動清理舊的熱更新沙盒以防止衝突...");
                try {
                    File filesDir = this.getFilesDir();
                    File versionFile = new File(filesDir, "current_hot_version.txt");
                    if (versionFile.exists()) {
                        versionFile.delete();
                    }
                    
                    // 掃描並遞迴刪除所有 update_pack_* 資料夾與 zip 檔
                    File[] files = filesDir.listFiles();
                    if (files != null) {
                        for (File file : files) {
                            if (file.getName().startsWith("update_pack_")) {
                                deleteRecursive(file);
                            }
                        }
                    }
                    Log.d(TAG, "🧹 舊熱更新沙盒清理完成。");
                } catch (Exception e) {
                    Log.e(TAG, "清理舊沙盒失敗", e);
                }
                
                // 記錄當前版本號，防止重複清理
                prefs.edit().putInt("last_apk_version_code", currentVersionCode).apply();
            }

            // 1. 取得手機內部私有沙盒實體目錄 (Directory.Data 對應於 Android 的 getFilesDir())
            File filesDir = this.getFilesDir();
            File versionFile = new File(filesDir, "current_hot_version.txt");
            
            if (versionFile.exists()) {
                BufferedReader br = new BufferedReader(new FileReader(versionFile));
                String versionCodeStr = br.readLine();
                br.close();
                
                if (versionCodeStr != null && !versionCodeStr.trim().isEmpty()) {
                    String ver = versionCodeStr.trim();
                    File zipFile = new File(filesDir, "update_pack_" + ver + ".zip");
                    File updateDir = new File(filesDir, "update_pack_" + ver);
                    File indexFile = new File(updateDir, "index.html");
                    
                    // 2. 🔍 檢查是否需要啟動原生解壓縮
                    if (!indexFile.exists() && zipFile.exists()) {
                        Log.d(TAG, "🐱 偵測到新版熱更新 ZIP 壓縮包，啟動閃電原生解壓縮...");
                        if (!updateDir.exists()) {
                            updateDir.mkdirs();
                        }
                        
                        // 執行極速原生解壓縮 (約 20ms)
                        long startTime = System.currentTimeMillis();
                        unzip(zipFile, updateDir);
                        long endTime = System.currentTimeMillis();
                        
                        Log.d(TAG, "⚡ 原生解壓完成！耗時: " + (endTime - startTime) + "ms");
                        
                        // 3. 🧹 解壓完畢後刪除 ZIP 原始包以釋放硬碟空間
                        if (zipFile.delete()) {
                            Log.d(TAG, "🧹 已刪除原始熱更新 ZIP 包，維持硬碟整潔。");
                        }
                    }
                    
                    // 4. 🚀 再次確認 index.html 存在，重定向 WebView 加載路徑！
                    if (indexFile.exists()) {
                        String localPath = updateDir.getAbsolutePath();
                        
                        // 💡 Capacitor 6 正確熱更新方式：變更 WebViewLocalServer 的 BasePath
                        try {
                            this.bridge.setServerBasePath(localPath);
                            Log.d(TAG, "✨ [熱更新注入成功] WebViewLocalServer 已切換沙盒路徑: " + localPath);
                        } catch (Exception ex) {
                            Log.e(TAG, "❌ 切換 BasePath 失敗，嘗試 fallback: " + ex.getMessage());
                            this.bridge.getWebView().loadUrl("file://" + indexFile.getAbsolutePath());
                        }
                    } else {
                        Log.w(TAG, "⚠️ 找不到沙盒 index.html，回退加載 APK 內建預置版本。");
                    }
                }
            } else {
                Log.d(TAG, "🐱 本地尚無下載的熱更新版本，加載 APK 內置預置版。");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ 熱更新處理失敗，自動降級安全回退至內置預置版：", e);
        }
    }

    /**
     * ⚡️ 高防護的原生 Zip 解壓縮核心 (自動建立多級資料夾，並防範 Zip Slip 安全性路徑攻擊)
     */
    void unzip(File zipFile, File targetDirectory) throws Exception {
        ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile)));
        try {
            ZipEntry ze;
            int count;
            byte[] buffer = new byte[8192];
            while ((ze = zis.getNextEntry()) != null) {
                File file = new File(targetDirectory, ze.getName());
                
                // 🔐 防止 Zip Slip 漏洞路徑穿越攻擊 (資安合規檢查)
                String canonicalPath = file.getCanonicalPath();
                if (!canonicalPath.startsWith(targetDirectory.getCanonicalPath())) {
                    throw new SecurityException("非法穿越的 Zip 路徑攻擊: " + ze.getName());
                }

                File dir = ze.isDirectory() ? file : file.getParentFile();
                if (!dir.isDirectory() && !dir.mkdirs()) {
                    throw new FileNotFoundException("無法建立沙盒資料夾: " + dir.getAbsolutePath());
                }
                
                if (ze.isDirectory()) {
                    continue;
                }
                
                FileOutputStream fout = new FileOutputStream(file);
                try {
                    while ((count = zis.read(buffer)) != -1) {
                        fout.write(buffer, 0, count);
                    }
                } finally {
                    fout.close();
                }
            }
        } finally {
            zis.close();
        }
    }

    /**
     * 🧹 遞迴刪除檔案或資料夾
     */
    private void deleteRecursive(File fileOrDirectory) {
        if (fileOrDirectory.isDirectory()) {
            File[] children = fileOrDirectory.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        fileOrDirectory.delete();
    }
}

/**
 * 🚀 DodoInstaller 原生 APK 一鍵覆蓋安裝自訂插件
 */
@CapacitorPlugin(name = "DodoInstaller")
class DodoInstallerPlugin extends Plugin {
    private static final String TAG = "DodoInstallerPlugin";

    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null || filePath.isEmpty()) {
            call.reject("filePath 參數不得為空");
            return;
        }

        try {
            // 💡 採用 Android 原生 Uri 與 URLDecoder 解析，100% 強健還原實體絕對路徑，防範 URL 編碼與 file:// 格式歧義
            String cleanPath = filePath;
            try {
                if (cleanPath.startsWith("file:") || cleanPath.contains("%")) {
                    cleanPath = java.net.URLDecoder.decode(cleanPath, "UTF-8");
                }
                Uri parsedUri = Uri.parse(cleanPath);
                if (parsedUri.getScheme() != null && parsedUri.getScheme().equals("file")) {
                    cleanPath = parsedUri.getPath();
                } else if (cleanPath.startsWith("file://")) {
                    cleanPath = cleanPath.substring(7);
                } else if (cleanPath.startsWith("file:/")) {
                    cleanPath = cleanPath.substring(6);
                }
            } catch (Exception e) {
                Log.e(TAG, "解析 filePath 時出錯，將嘗試直接使用原字串", e);
            }

            File file = new File(cleanPath);
            if (!file.exists()) {
                // 💡 嘗試兜底：如果沒解碼過的原 filePath 存在，就用它
                File fallbackFile = new File(filePath.startsWith("file://") ? filePath.substring(7) : filePath);
                if (fallbackFile.exists()) {
                    file = fallbackFile;
                } else {
                    Log.e(TAG, "❌ 找不到 APK 檔案。解析後路徑: " + file.getAbsolutePath() + "，原始路徑: " + filePath);
                    call.reject("找不到指定的 APK 檔案，請檢查儲存權限或重新下載喵🐾");
                    return;
                }
            }

            Context context = getContext();

            // 1. 🔍 針對 Android 8.0+ 檢查是否擁有「安裝未知來源應用程式」的權限
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!context.getPackageManager().canRequestPackageInstalls()) {
                    Log.w(TAG, "🐱 偵測到未開啟「安裝未知來源應用程式」權限，準備引導跳轉...");
                    Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    settingsIntent.setData(Uri.parse("package:" + context.getPackageName()));
                    settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(settingsIntent);
                    call.reject("請先在系統設定中允許 Dodo Ledger 安裝未知應用程式，然後重新點擊更新喵🐾");
                    return;
                }
            }

            // 2. 🛡️ 針對私有沙盒路徑做相容性處理：
            // 如果 APK 檔案位於私有內部快取目錄，有些系統的 PackageInstaller 會拒絕讀取（即便有 FileProvider）。
            // 我們將其複製到「外部快取目錄」中以確保 100% 成功安裝。
            File finalFile = file;
            String privateCachePath = context.getCacheDir().getAbsolutePath();
            if (file.getAbsolutePath().startsWith(privateCachePath)) {
                File externalCacheDir = context.getExternalCacheDir();
                if (externalCacheDir != null) {
                    File tempFile = new File(externalCacheDir, "update_temp.apk");
                    // 執行複製
                    try (java.io.InputStream in = new java.io.FileInputStream(file);
                         java.io.OutputStream out = new java.io.FileOutputStream(tempFile)) {
                        byte[] buffer = new byte[4096];
                        int length;
                        while ((length = in.read(buffer)) > 0) {
                            out.write(buffer, 0, length);
                        }
                        out.flush();
                        finalFile = tempFile;
                        Log.d(TAG, "🐱 已成功將私有沙盒 APK 複製到外部快取目錄: " + finalFile.getAbsolutePath());
                    } catch (Exception e) {
                        Log.e(TAG, "複製 APK 到外部快取失敗，將嘗試使用原路徑安裝", e);
                    }
                }
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            
            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                String authority = context.getPackageName() + ".fileprovider";
                apkUri = FileProvider.getUriForFile(context, authority, finalFile);
                
                // 授權
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                
                // 顯式地為所有符合條件 of Activity 授予權限
                List<ResolveInfo> resInfoList = context.getPackageManager().queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
                for (ResolveInfo resolveInfo : resInfoList) {
                    String packageName = resolveInfo.activityInfo.packageName;
                    context.grantUriPermission(packageName, apkUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }
            } else {
                apkUri = Uri.fromFile(finalFile);
            }

            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            // 💡 關鍵優化：在 Activity Context 下呼叫 startActivity 喚起安裝，比起 Application Context 具有極佳的手機 ROM 相容性
            if (getActivity() != null) {
                getActivity().startActivity(intent);
            } else {
                context.startActivity(intent);
            }
            call.resolve();
            Log.d(TAG, "🚀 已成功發起系統原生覆蓋安裝 Intent，實際安裝檔案: " + finalFile.getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "安裝 APK 時出錯", e);
            call.reject("發起系統安裝失敗: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getAppVersion(PluginCall call) {
        try {
            Context context = getContext();
            String versionName = context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionName;
            int versionCode = 0;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                versionCode = (int) context.getPackageManager().getPackageInfo(context.getPackageName(), 0).getLongVersionCode();
            } else {
                versionCode = context.getPackageManager().getPackageInfo(context.getPackageName(), 0).versionCode;
            }
            JSObject ret = new JSObject();
            ret.put("versionName", versionName);
            ret.put("versionCode", versionCode);
            call.resolve(ret);
            Log.d(TAG, "🔍 獲取原生 APK 版本資訊成功: v" + versionName + " (Build " + versionCode + ")");
        } catch (Exception e) {
            Log.e(TAG, "無法獲取原生版本資訊", e);
            call.reject("無法獲取原生版本資訊: " + e.getMessage());
        }
    }

    @PluginMethod
    public void performHotReload(PluginCall call) {
        String versionCode = call.getString("versionCode");
        if (versionCode == null || versionCode.isEmpty()) {
            call.reject("versionCode 參數不得為空");
            return;
        }

        try {
            MainActivity activity = (MainActivity) getActivity();
            File filesDir = activity.getFilesDir();
            File zipFile = new File(filesDir, "update_pack_" + versionCode + ".zip");
            File updateDir = new File(filesDir, "update_pack_" + versionCode);
            File indexFile = new File(updateDir, "index.html");

            // 1. 🔍 如果解壓目錄中的 index.html 不存在，但 ZIP 存在，則立即在背景解壓
            if (!indexFile.exists() && zipFile.exists()) {
                Log.d("DodoLedger_HotReload", "📦 熱重載：偵測到 ZIP 壓縮包，執行原生解壓縮...");
                if (!updateDir.exists()) {
                    updateDir.mkdirs();
                }
                activity.unzip(zipFile, updateDir);
                Log.d("DodoLedger_HotReload", "⚡ 熱重載：解壓完成");

                // 刪除原始 ZIP
                if (zipFile.delete()) {
                    Log.d("DodoLedger_HotReload", "🧹 已刪除原始熱更新 ZIP 包");
                }
            }

            // 2. 🚀 再次確認 index.html 存在，重定向 WebView 加載路徑！
            if (updateDir.exists() && indexFile.exists()) {
                String localPath = updateDir.getAbsolutePath();

                // 必須在 UI 執行緒操作 WebView
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            activity.getBridge().setServerBasePath(localPath);
                            // 💡 關鍵修復：清除 WebView 快取，避免載入舊版暫存資源，導致使用者覺得「重載完沒反應」
                            activity.getBridge().getWebView().clearCache(true);
                            activity.getBridge().getWebView().reload();
                            Log.d("DodoLedger_HotReload", "✨ [熱重載成功] WebView 已切換至沙盒並清除快取、重載: " + localPath);
                            call.resolve();
                        } catch (Exception e) {
                            Log.e("DodoLedger_HotReload", "熱重載 WebView 操作失敗", e);
                            call.reject("熱重載 WebView 操作失敗: " + e.getMessage());
                        }
                    }
                });
            } else {
                Log.e("DodoLedger_HotReload", "❌ 找不到熱更新資源。目錄存在: " + updateDir.exists() + ", 檔案存在: " + indexFile.exists());
                if (updateDir.exists()) {
                    File[] list = updateDir.listFiles();
                    if (list != null) {
                        for (File f : list) {
                            Log.e("DodoLedger_HotReload", "  - 沙盒內檔案: " + f.getName() + " (大小: " + f.length() + ")");
                        }
                    }
                }
                call.reject("找不到解壓後的熱更新資源或 index.html");
            }
        } catch (Exception e) {
            Log.e("DodoLedger_HotReload", "熱重載處理失敗", e);
            call.reject("熱重載處理失敗: " + e.getMessage());
        }
    }
}

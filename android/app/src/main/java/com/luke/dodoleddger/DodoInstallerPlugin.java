package com.luke.dodoleddger;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.util.Log;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.List;

/**
 * 🚀 DodoInstaller 原生 APK 一鍵覆蓋安裝自訂插件
 */
@CapacitorPlugin(name = "DodoInstaller")
public class DodoInstallerPlugin extends Plugin {
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
            Context context = getContext();
            File filesDir = context.getFilesDir();
            File zipFile = new File(filesDir, "update_pack_" + versionCode + ".zip");
            File updateDir = new File(filesDir, "update_pack_" + versionCode);
            File tempUpdateDir = new File(filesDir, "update_pack_" + versionCode + "_temp");
            File indexFile = new File(updateDir, "index.html");

            // 1. 🔍 如果解壓目錄中的 index.html 不存在，但 ZIP 存在，則立即在背景解壓 (原子解壓縮)
            if (!indexFile.exists() && zipFile.exists()) {
                Log.d("DodoLedger_HotReload", "📦 熱重載：偵測到 ZIP 壓縮包，執行原生原子解壓縮...");
                if (tempUpdateDir.exists()) {
                    MainActivity.deleteRecursive(tempUpdateDir);
                }
                tempUpdateDir.mkdirs();
                
                try {
                    MainActivity.unzip(zipFile, tempUpdateDir);
                    File tempIndex = new File(tempUpdateDir, "index.html");
                    if (tempIndex.exists()) {
                        if (updateDir.exists()) {
                            MainActivity.deleteRecursive(updateDir);
                        }
                        if (tempUpdateDir.renameTo(updateDir)) {
                            Log.d("DodoLedger_HotReload", "⚡ 熱重載：解壓與重命名完成");
                            // 刪除原始 ZIP
                            if (zipFile.delete()) {
                                Log.d("DodoLedger_HotReload", "🧹 已刪除原始熱更新 ZIP 包");
                            }
                        } else {
                            throw new Exception("暫存目錄重命名為正式目錄失敗");
                        }
                    } else {
                        throw new Exception("暫存目錄中找不到 index.html，解壓可能不完整");
                    }
                } catch (Exception e) {
                    Log.e("DodoLedger_HotReload", "❌ 熱重載原子解壓失敗，清除暫存目錄", e);
                    MainActivity.deleteRecursive(tempUpdateDir);
                    call.reject("熱重載解壓縮失敗: " + e.getMessage());
                    return;
                }
            }

            // 2. 🚀 再次確認 index.html 存在，重定向 WebView 加載路徑！
            if (updateDir.exists() && indexFile.exists()) {
                final String localPath = updateDir.getAbsolutePath();

                if (getActivity() == null) {
                    call.reject("Activity 實例不存在，無法執行 UI 重載");
                    return;
                }

                // 必須在 UI 執行緒操作 WebView
                getActivity().runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            getBridge().setServerBasePath(localPath);
                            // 💡 關鍵修復：清除 WebView 快取，避免載入舊版暫存資源，導致使用者覺得「重載完沒反應」
                            getBridge().getWebView().clearCache(true);
                            getBridge().getWebView().reload();
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

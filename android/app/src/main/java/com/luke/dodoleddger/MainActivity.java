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

public class MainActivity extends BridgeActivity {
    private static final String TAG = "DodoLedger_HotUpdate";

    @Override
    public void onCreate(Bundle savedInstanceState) {
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
    private void unzip(File zipFile, File targetDirectory) throws Exception {
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

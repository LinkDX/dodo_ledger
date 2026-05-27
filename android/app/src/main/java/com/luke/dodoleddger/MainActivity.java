package com.luke.dodoleddger;

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
                        String localPath = "file://" + indexFile.getAbsolutePath();
                        this.bridge.setServerUrl(localPath);
                        Log.d(TAG, "✨ [熱更新啟動成功] WebView 已成功重定向加載沙盒路徑: " + localPath);
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
}

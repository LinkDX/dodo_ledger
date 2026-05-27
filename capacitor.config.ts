import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.luke.dodoleddger',
  appName: 'Dodo Ledger',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#4A3E3D',
      sound: 'beep.wav'
    }
  }
};

export default config;

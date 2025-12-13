import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.ksef.platform',
    appName: 'KSEF Online',
    webDir: 'dist',
    server: {
        androidScheme: 'https'
    },
    android: {
        allowMixedContent: true
    }
};

export default config;

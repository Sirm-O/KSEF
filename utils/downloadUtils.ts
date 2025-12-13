import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import jsPDF from 'jspdf';

/**
 * Saves a jsPDF document using native filesystem APIs if running as an app,
 * or standard browser download if running on web.
 * 
 * @param doc The jsPDF document instance
 * @param fileName The desired filename (e.g., 'report.pdf')
 */
export const saveProfileOrFile = async (doc: jsPDF, fileName: string): Promise<boolean> => {
    if (Capacitor.isNativePlatform()) {
        try {
            // Get the data URI (this includes the prefix "data:application/pdf;base64,")
            const dataUri = doc.output('datauristring');
            // Remove the prefix to get just the base64 data
            const base64Data = dataUri.split(',')[1];

            // Write the file to the Documents directory on the device
            const savedFile = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Documents,
            });

            // Open the system share sheet so the user can save to files or open in a PDF viewer
            // This provides a better UX than just silently saving
            await Share.share({
                title: 'Download Complete',
                text: `File ${fileName} is ready.`,
                url: savedFile.uri,
                dialogTitle: 'Share or Open PDF',
            });

            return true;
        } catch (error) {
            console.error('Error saving file natively:', error);
            // Fallback: try sharing the base64 data directly if file write fails, though less reliable for large files
            try {
                const dataUri = doc.output('datauristring');
                await Share.share({
                    title: fileName,
                    files: [dataUri]
                });
                return true;
            } catch (shareError) {
                console.error('Fallback share failed:', shareError);
                alert('Failed to save file. Please check permissions.');
                return false;
            }
        }
    } else {
        // Web fallback: standard browser download
        doc.save(fileName);
        return true;
    }
};

/**
 * Saves a string content (e.g. CSV) as a file using native filesystem APIs if running as an app,
 * or standard browser download if running on web.
 * 
 * @param content The text content to save
 * @param fileName The desired filename (e.g., 'data.csv')
 */
export const saveCsvOrText = async (content: string, fileName: string): Promise<boolean> => {
    if (Capacitor.isNativePlatform()) {
        try {
            // Write the file to the Documents directory on the device
            const savedFile = await Filesystem.writeFile({
                path: fileName,
                data: content,
                directory: Directory.Documents,
                encoding: Encoding.UTF8 // Important for text files
            });

            await Share.share({
                title: 'Download Complete',
                text: `File ${fileName} is ready.`,
                url: savedFile.uri,
                dialogTitle: 'Share or Open CSV',
            });

            return true;
        } catch (error) {
            console.error('Error saving CSV natively:', error);
            alert('Failed to save file: ' + (error as any).message);
            return false;
        }
    } else {
        // Web fallback
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return true;
    }
};

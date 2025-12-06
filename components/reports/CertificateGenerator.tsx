import jsPDF from 'jspdf';
import { CompetitionLevel } from '../../types';

// Updated to use the PNG logo instead of embedded SVG
// We'll load the PNG and convert it to a data URL for use in the PDF
const KSEF_LOGO_PATH = '/KSEF Logo.png';

interface CertificateDetails {
    doc: jsPDF;
    name: string;
    type: 'Student' | 'Patron' | 'School' | 'Judge';
    projectTitle?: string;
    school?: string;
    levelFrom: CompetitionLevel;
    levelTo?: CompetitionLevel;
    editionName: string;
    region?: string;
    county?: string;
    subCounty?: string;
    tscNumber?: string;
    idNumber?: string;
    category?: string;
    award?: string;
    isWinner?: boolean;
    isParticipant?: boolean;
    projectsList?: string[];
}

export const addCertificatePage = async ({ doc, name, type, projectTitle, school, levelFrom, levelTo, editionName, region, county, subCounty, tscNumber, idNumber, category, award, isWinner, isParticipant, projectsList }: CertificateDetails) => {
    // 1. Determine level-specific text
    let competitionTitle = '';
    let signatory1 = '';
    let signatory2 = '';

    switch (levelFrom) {
        case CompetitionLevel.SUB_COUNTY:
            competitionTitle = `${subCounty?.toUpperCase()} SUB-COUNTY`;
            signatory1 = 'Sub-County Chair, KSEF';
            signatory2 = 'Sub-County Director of Education';
            break;
        case CompetitionLevel.COUNTY:
            competitionTitle = `${county?.toUpperCase()} COUNTY`;
            signatory1 = 'County Chair, KSEF';
            signatory2 = 'County Director of Education';
            break;
        case CompetitionLevel.REGIONAL:
            competitionTitle = `${region?.toUpperCase()} REGION`;
            signatory1 = 'Regional Chair, KSEF';
            signatory2 = 'Regional Director of Education';
            break;
        case CompetitionLevel.NATIONAL:
            competitionTitle = 'NATIONAL';
            signatory1 = 'National Chair, KSEF';
            signatory2 = 'Director, Science, Technology & Innovation';
            break;
    }

    // 2. Determine role-specific styling and text
    let certTitle = '';
    let nameColor = '#007EA7';
    let borderColor = '#003459';
    let accentColor = '#64FFDA';

    // Special styling for national level winners
    if (levelFrom === CompetitionLevel.NATIONAL && isWinner) {
        // Gold for 1st place, Silver for 2nd, Bronze for 3rd
        if (award && award.includes('Position 1')) {
            // Gold styling
            nameColor = '#D4AF37'; // Gold
            borderColor = '#B8860B'; // Darker gold
            accentColor = '#FFD700'; // Bright gold
            certTitle = 'Certificate of Excellence - 1st Place';
        } else if (award && award.includes('Position 2')) {
            // Silver styling
            nameColor = '#C0C0C0'; // Silver
            borderColor = '#A9A9A9'; // Darker silver
            accentColor = '#D3D3D3'; // Light silver
            certTitle = 'Certificate of Excellence - 2nd Place';
        } else if (award && award.includes('Position 3')) {
            // Bronze styling
            nameColor = '#CD7F32'; // Bronze
            borderColor = '#A0522D'; // Darker bronze
            accentColor = '#DEB887'; // Light bronze
            certTitle = 'Certificate of Excellence - 3rd Place';
        } else {
            certTitle = 'Certificate of Excellence';
        }
    } else if (levelFrom === CompetitionLevel.NATIONAL && isParticipant) {
        // Special styling for national level participants
        certTitle = 'Certificate of National Participation';
        nameColor = '#009530'; // Green
        borderColor = '#00A8E8'; // Light Blue
        accentColor = '#64FFDA'; // KSEF Accent Green
    } else {
        // Default styling for all other cases
        switch (type) {
            case 'Student':
                certTitle = 'Certificate of Qualification';
                nameColor = '#009530'; // Green
                borderColor = '#00A8E8'; // Light Blue
                accentColor = '#64FFDA'; // KSEF Accent Green
                break;
            case 'Patron':
                certTitle = 'Certificate of Mentorship';
                nameColor = '#007EA7'; // Dark Blue
                borderColor = '#009530'; // Kenyan Green
                accentColor = '#00A8E8'; // KSEF Light Blue
                break;
            case 'School':
                certTitle = 'Certificate of Participation';
                nameColor = '#003459'; // Deep Blue
                borderColor = '#009530'; // Kenyan Green
                accentColor = '#00A8E8'; // KSEF Light Blue
                break;
            case 'Judge':
                certTitle = 'Certificate of Service';
                nameColor = '#CE2A28'; // Red
                borderColor = '#003459'; // Deep Blue
                accentColor = '#FFBB28'; // Yellow accent
                break;
        }
    }


    // 3. Draw the certificate
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Subtle background
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Borders
    doc.setLineWidth(1.5);
    doc.setDrawColor(borderColor);
    doc.rect(5, 5, pageWidth - 10, pageHeight - 10); // Outer border

    doc.setLineWidth(0.5);
    doc.setDrawColor(accentColor);
    doc.rect(8, 8, pageWidth - 16, pageHeight - 16); // Inner border


    // Header Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(borderColor);
    doc.text('KENYA SCIENCE AND ENGINEERING FAIR', pageWidth / 2, 25, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(borderColor);
    doc.text(`${editionName} - ${competitionTitle} LEVEL`, pageWidth / 2, 35, { align: 'center' });

    // Add the logo
    const logoMaxWidth = 30;
    const logoMaxHeight = 30;

    try {
        // Create a promise that resolves with the image data URL
        const loadImage = (src: string): Promise<{ dataUrl: string, width: number, height: number }> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        resolve({
                            dataUrl: canvas.toDataURL('image/png'),
                            width: img.width,
                            height: img.height
                        });
                    } else {
                        reject(new Error('Could not get canvas context'));
                    }
                };
                img.onerror = reject;
                img.src = src;
            });
        };

        // Load and convert the PNG logo to data URL
        const logoInfo = await loadImage(KSEF_LOGO_PATH);

        // Calculate dimensions maintaining aspect ratio
        const aspectRatio = logoInfo.width / logoInfo.height;
        let displayWidth = logoMaxWidth;
        let displayHeight = logoMaxHeight;

        if (aspectRatio > 1) {
            // Width is greater than height (landscape)
            displayHeight = logoMaxWidth / aspectRatio;
        } else {
            // Height is greater than or equal to width (portrait or square)
            displayWidth = logoMaxHeight * aspectRatio;
        }

        // Center the logo
        const xPos = (pageWidth / 2) - (displayWidth / 2);

        doc.addImage(logoInfo.dataUrl, 'PNG', xPos, 42, displayWidth, displayHeight);
    } catch (error) {
        console.error("Failed to add logo image:", error);
        // Fallback: If logo fails to load, we'll skip it rather than break the certificate
    }

    let yPos = 85;
    doc.setFont('times', 'normal');
    doc.setFontSize(32);
    doc.setTextColor('#34495e');
    doc.text(certTitle, pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;

    doc.setFontSize(16);
    doc.text('This is to certify that', pageWidth / 2, yPos, { align: 'center' });
    yPos += 14;

    doc.setFont('times', 'bold');
    doc.setFontSize(32);
    doc.setTextColor(nameColor);
    doc.text(name, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    if ((type === 'Patron' || type === 'Judge') && (tscNumber || idNumber)) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor('#34495e');
        const detailsLine = [
            tscNumber ? `TSC No: ${tscNumber}` : '',
            idNumber ? `ID No: ${idNumber}` : ''
        ].filter(Boolean).join('   |   ');

        doc.text(detailsLine, pageWidth / 2, yPos, { align: 'center' });
        yPos += 6;
    }

    doc.setFont('times', 'normal');
    doc.setFontSize(14);
    doc.setTextColor('#34495e');

    if (levelFrom === CompetitionLevel.NATIONAL && isWinner) {
        // Special text for national winners
        doc.text('of', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        doc.setFont('times', 'bold');
        doc.setFontSize(18);
        doc.setTextColor('#003459');
        doc.text(school || '', pageWidth / 2, yPos, { align: 'center' });
        yPos += 12;

        let fullText = '';
        if (type === 'Student') {
            fullText = `has been awarded ${award} at the ${editionName} National Level for their exceptional research work on the project titled: "${projectTitle}" in the ${category} category. Their scientific inquiry, creativity, and dedication have demonstrated outstanding achievement in the national competition.`;
        } else if (type === 'Patron') { // Patron
            fullText = `has been awarded ${award} at the ${editionName} National Level for their exceptional mentorship of the project titled: "${projectTitle}" in the ${category} category. Their guidance has been instrumental in nurturing scientific talent and fostering innovation.`;
        } else { // School
            fullText = `has been awarded ${award} at the ${editionName} National Level for supporting the project titled: "${projectTitle}" in the ${category} category. The institution's commitment to scientific education and research excellence has contributed significantly to this national achievement.`;
        }

        const textLines = doc.splitTextToSize(fullText, pageWidth - 80); // 40mm margin on each side
        doc.text(textLines, pageWidth / 2, yPos, { align: 'center' });
        yPos += (textLines.length * 5) + 5; // Adjust yPos based on number of lines
    } else if (levelFrom === CompetitionLevel.NATIONAL && isParticipant) {
        // Special text for national participants
        doc.text('of', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        doc.setFont('times', 'bold');
        doc.setFontSize(18);
        doc.setTextColor('#003459');
        doc.text(school || '', pageWidth / 2, yPos, { align: 'center' });
        yPos += 12;

        let fullText = '';
        if (type === 'Student') {
            fullText = `for their outstanding participation in the ${editionName} National Level with the project titled: "${projectTitle}" in the ${category} category. Their dedication to scientific research and innovation has contributed to the excellence of the national competition.`;
        } else if (type === 'Patron') { // Patron
            fullText = `for their exceptional mentorship of the project titled: "${projectTitle}" in the ${category} category during the ${editionName} National Level. Their support has been vital in advancing scientific inquiry and student development.`;
        } else { // School
            fullText = `for supporting student participation in the ${editionName} National Level with the project titled: "${projectTitle}" in the ${category} category. The institution's commitment to scientific education has contributed to the success of the national competition.`;
        }

        const textLines = doc.splitTextToSize(fullText, pageWidth - 80); // 40mm margin on each side
        doc.text(textLines, pageWidth / 2, yPos, { align: 'center' });
        yPos += (textLines.length * 5) + 5; // Adjust yPos based on number of lines
    } else if (type === 'Student' || type === 'Patron') {
        doc.text('of', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        doc.setFont('times', 'bold');
        doc.setFontSize(18);
        doc.setTextColor('#003459');
        doc.text(school || '', pageWidth / 2, yPos, { align: 'center' });
        yPos += 12;

        let fullText = '';
        if (type === 'Student') {
            fullText = `for your outstanding contribution as a student researcher in the project titled: "${projectTitle}" in the ${category} category during the ${editionName}. Their dedication and scientific inquiry have demonstrated excellence in the ${levelFrom} Level competition.`;
        } else { // Patron
            fullText = `for an exceptional mentorship and guidance to the student researchers working on the project titled: "${projectTitle}" in the ${category} category during the ${editionName}. Their support has been instrumental in fostering scientific excellence.`;
        }

        const textLines = doc.splitTextToSize(fullText, pageWidth - 80); // 40mm margin on each side
        doc.text(textLines, pageWidth / 2, yPos, { align: 'center' });
        yPos += (textLines.length * 5) + 5; // Adjust yPos based on number of lines

    } else if (type === 'Judge') {
        const fullText = `for your dedicated service as a Judge during the ${editionName} ${competitionTitle} Level competition. Their expertise, fairness, and commitment to scientific excellence have been invaluable to the competition process.`;
        const textLines = doc.splitTextToSize(fullText, pageWidth - 80); // 40mm margin on each side
        doc.text(textLines, pageWidth / 2, yPos, { align: 'center' });
        yPos += (textLines.length * 5) + 5; // Adjust yPos based on number of lines

        if (category) {
            doc.setFont('times', 'normal');
            doc.setFontSize(14);
            doc.setTextColor('#34495e');
            doc.text(`Categories Judged:`, pageWidth / 2, yPos, { align: 'center' });
            yPos += 8;
            doc.setFont('times', 'bold');
            doc.setFontSize(16);
            doc.setTextColor('#003459');
            const categoryLines = doc.splitTextToSize(category, pageWidth - 80);
            doc.text(categoryLines, pageWidth / 2, yPos, { align: 'center' });
            yPos += (categoryLines.length * 6);
        }
    } else { // School
        const fullText = `for fostering an environment of scientific inquiry and innovation. The institution has demonstrated outstanding support for student research projects during the ${editionName} at the ${levelFrom} Level competition.`;
        const textLines = doc.splitTextToSize(fullText, pageWidth - 80); // 40mm margin on each side
        doc.text(textLines, pageWidth / 2, yPos, { align: 'center' });
        yPos += (textLines.length * 5) + 5; // Adjust yPos based on number of lines
    }

    // --- DYNAMIC FOOTER ---
    const finalContentY = yPos;
    const minimumSignatureY = pageHeight - 70;
    const signatureY = Math.max(finalContentY + 10, minimumSignatureY);

    const signatureLineY = signatureY + 10;
    const signatureLabelY = signatureY + 15;

    doc.setFontSize(12);
    doc.setTextColor('#34495e');
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth / 2, signatureY, { align: 'center' });

    doc.setFontSize(10);
    doc.setLineWidth(0.3);
    doc.setDrawColor(borderColor);

    // Signature 1
    doc.line(pageWidth * 0.15, signatureLineY, pageWidth * 0.45, signatureLineY);
    doc.text(signatory1, pageWidth * 0.3, signatureLabelY, { align: 'center' });

    // Signature 2
    doc.line(pageWidth * 0.55, signatureLineY, pageWidth * 0.85, signatureLineY);
    doc.text(signatory2, pageWidth * 0.7, signatureLabelY, { align: 'center' });
};

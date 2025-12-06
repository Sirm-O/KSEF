
import { jsPDF } from "jspdf";
import fs from "fs";

const doc = new jsPDF();
const content = fs.readFileSync("USER_MANUAL.md", "utf-8");
const lines = content.split("\n");

let y = 20;
const pageHeight = doc.internal.pageSize.height;
const pageWidth = doc.internal.pageSize.width;
const margin = 20;
const lineHeight = 6.5; // Slightly reduced to keep paragraphs cohesive
let pageNumber = 1;

// Colors
const PRIMARY_COLOR = [0, 52, 89]; // Dark Blue
const SECONDARY_COLOR = [0, 168, 232]; // Light Blue
const TEXT_COLOR = [60, 60, 60]; // Dark Gray
const ACCENT_COLOR = [255, 165, 0]; // Orange for highlights

doc.setFont("helvetica", "normal");

function addFooter() {
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${pageNumber}`, pageWidth - margin, pageHeight - 10, { align: "right" });
    doc.text("KSEF Management System User Manual", margin, pageHeight - 10);
    pageNumber++;
}

function checkPageBreak(neededSpace) {
    if (y + neededSpace > pageHeight - margin) {
        addFooter();
        doc.addPage();
        y = 20;
    }
}

// Helper to print text with bold segments
// Segments format: [ { text: "foo", bold: false }, { text: "bar", bold: true } ]
function printStyledText(line, x, startY, fontSize, color) {
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);

    // Parse markdown bold **text**
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const segments = parts.map(part => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return { text: part.slice(2, -2), bold: true };
        }
        return { text: part, bold: false };
    });

    // We need to handle wrapping manually for mixed styles
    // This is complex, so we'll simplify: 
    // If a line has bold parts, we'll try to print it line by line.
    // But splitTextToSize doesn't know about styles.
    // Strategy: Remove ** for wrapping calculation, then reconstruct.
    // Actually, for a manual, simpler is better:
    // We will just strip ** and print the whole line bold if it has "Note:" or "Caution:"
    // OR we can try to render bold words.

    // Let's try a robust approach:
    // 1. Calculate available width.
    // 2. Tokenize by words.
    // 3. Build lines.

    const maxWidth = pageWidth - (margin * 2);
    let currentLine = [];
    let currentLineWidth = 0;
    let cursorY = startY;

    const spaceWidth = doc.getStringUnitWidth(" ") * fontSize / doc.internal.scaleFactor;

    segments.forEach(segment => {
        doc.setFont("helvetica", segment.bold ? "bold" : "normal");
        const words = segment.text.split(/(\s+)/); // Split keeping spaces

        words.forEach(word => {
            const wordWidth = doc.getStringUnitWidth(word) * fontSize / doc.internal.scaleFactor;

            if (currentLineWidth + wordWidth > maxWidth) {
                // Print current line
                let cursorX = x;
                currentLine.forEach(chunk => {
                    doc.setFont("helvetica", chunk.bold ? "bold" : "normal");
                    doc.text(chunk.text, cursorX, cursorY);
                    cursorX += doc.getStringUnitWidth(chunk.text) * fontSize / doc.internal.scaleFactor;
                });
                cursorY += lineHeight;
                currentLine = [];
                currentLineWidth = 0;

                // If the word itself is too long (unlikely), it will overflow.
                // Trim leading space for new line
                if (word.trim() === "") return;
            }

            currentLine.push({ text: word, bold: segment.bold });
            currentLineWidth += wordWidth;
        });
    });

    // Print last line
    if (currentLine.length > 0) {
        let cursorX = x;
        currentLine.forEach(chunk => {
            doc.setFont("helvetica", chunk.bold ? "bold" : "normal");
            doc.text(chunk.text, cursorX, cursorY);
            cursorX += doc.getStringUnitWidth(chunk.text) * fontSize / doc.internal.scaleFactor;
        });
        cursorY += lineHeight;
    }

    return cursorY; // Return new Y
}


// Title Page
doc.setFillColor(...PRIMARY_COLOR);
doc.rect(0, 0, pageWidth, pageHeight, "F");
doc.setTextColor(255, 255, 255);
doc.setFontSize(30);
doc.setFont("helvetica", "bold");
doc.text("KSEF Management System", pageWidth / 2, pageHeight / 2 - 20, { align: "center" });
doc.setFontSize(20);
doc.setFont("helvetica", "normal");
doc.text("User Manual", pageWidth / 2, pageHeight / 2 + 10, { align: "center" });
doc.setFontSize(12);
doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - 30, { align: "center" });

doc.addPage();
y = 30;

lines.forEach((line) => {
    line = line.trim();
    if (!line) return;

    if (line.startsWith("# ")) {
        // Main Title
        checkPageBreak(25);
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(...PRIMARY_COLOR);
        doc.text(line.replace("# ", ""), margin, y);

        // Underline below text
        y += 3;
        doc.setFillColor(...PRIMARY_COLOR);
        doc.rect(margin, y, pageWidth - (margin * 2), 1, "F");
        y += 15;

    } else if (line.startsWith("## ")) {
        // Section Header
        checkPageBreak(20);
        y += 10; // Extra space before header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(...SECONDARY_COLOR);
        doc.text(line.replace("## ", ""), margin, y);
        y += 8;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y - 2, pageWidth - margin, y - 2);
        y += 5;

    } else if (line.startsWith("### ")) {
        // Sub-section Header
        checkPageBreak(15);
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...TEXT_COLOR);
        doc.text(line.replace("### ", ""), margin, y);
        y += 8;

    } else if (line.startsWith("- ") || line.startsWith("* ")) {
        // Bullet points
        checkPageBreak(lineHeight * 2); // Ensure at least 2 lines fit

        // Draw bullet
        doc.setFillColor(...SECONDARY_COLOR);
        doc.circle(margin + 2, y - (lineHeight / 2) + 1, 1, "F");

        const text = line.replace(/^[-*] /, "");
        y = printStyledText(text, margin + 8, y, 11, TEXT_COLOR);

    } else if (line.match(/^\d+\./)) {
        // Numbered list
        checkPageBreak(lineHeight * 2);

        const number = line.match(/^\d+\./)[0];
        const text = line.replace(/^\d+\.\s*/, "");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...TEXT_COLOR);
        doc.text(number, margin, y);

        y = printStyledText(text, margin + 10, y, 11, TEXT_COLOR);

    } else if (line.startsWith("---")) {
        // Horizontal Rule
        checkPageBreak(15);
        y += 5;
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;

    } else {
        // Normal Text
        checkPageBreak(lineHeight);

        // Special handling for Note/Caution
        if (line.includes("Note:") || line.includes("Caution:")) {
            // Add a background or side bar?
            // Let's just color it
            let color = TEXT_COLOR;
            if (line.includes("Caution:")) color = [200, 0, 0];
            else if (line.includes("Note:")) color = [0, 52, 89];

            // Make the whole line bold for these alerts
            line = "**" + line + "**";
            y = printStyledText(line, margin, y, 11, color);
        } else {
            y = printStyledText(line, margin, y, 11, TEXT_COLOR);
        }
    }
});

addFooter();

doc.save("USER_MANUAL.pdf");
console.log("USER_MANUAL.pdf generated successfully");


import { jsPDF } from "jspdf";

const doc = new jsPDF();
doc.text("Hello world", 10, 10);
doc.save("test.pdf");
console.log("PDF generated");

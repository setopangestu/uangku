const express = require('express');
const PDFDocument = require('pdfkit');
const { createClient } = require('@supabase/supabase-js');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Format number to Indonesian Rupiah
 */
function formatRupiah(n) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(n || 0);
}

/**
 * Format date to Indonesian locale
 */
function formatTanggal(date) {
    return new Date(date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    });
}

/**
 * Calculate financial summary from transactions
 */
function calculateSummary(transactions) {
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(t => {
        if (t.type === 'income') {
            totalIncome += parseFloat(t.amount);
        } else {
            totalExpense += parseFloat(t.amount);
        }
    });
    
    return {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense
    };
}

/**
 * Draw horizontal divider line
 */
function drawDivider(doc, y, margin, pageWidth) {
    doc.strokeColor('#E8ECEF')
        .lineWidth(0.5)
        .moveTo(margin, y)
        .lineTo(pageWidth - margin, y)
        .stroke();
    return doc;
}

/**
 * Draw header section
 */
function drawHeader(doc, options) {
    const { margin, pageWidth, periodeText, printDate, userName } = options;
    
    // Title
    doc.fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#1A1A2E')
        .text('LAPORAN KEUANGAN', margin, 40, {
            align: 'center',
            width: pageWidth - (margin * 2)
        });
    
    // Subtitle
    doc.fontSize(11)
        .font('Helvetica')
        .fillColor('#6C6C80')
        .text('Financial Report', {
            align: 'center'
        })
        .moveDown(0.5);
    
    // Metadata
    doc.fontSize(8)
        .fillColor('#9CA3AF')
        .text(periodeText, { align: 'center' })
        .text(`Printed: ${printDate}`, { align: 'center' })
        .text(`User: ${userName}`, { align: 'center' })
        .moveDown(1);
    
    drawDivider(doc, doc.y - 5, margin, pageWidth);
    doc.moveDown(0.5);
    
    return doc;
}

/**
 * Draw summary cards (modern minimalis style)
 */
function drawSummaryCards(doc, summary, margin, pageWidth) {
    const contentWidth = pageWidth - (margin * 2);
    const cardWidth = (contentWidth - 40) / 3;
    const startY = doc.y;
    
    // Card headers
    const cards = [
        { title: 'PEMASUKAN', color: '#10B981', value: summary.totalIncome },
        { title: 'PENGELUARAN', color: '#EF4444', value: summary.totalExpense },
        { title: 'SALDO', color: '#3B82F6', value: summary.balance }
    ];
    
    doc.fontSize(8)
        .font('Helvetica-Bold')
        .fillColor('#6B7280');
    
    cards.forEach((card, idx) => {
        const x = margin + (idx * (cardWidth + 20));
        doc.text(card.title, x, startY, { width: cardWidth, align: 'center' });
    });
    
    doc.moveDown(0.8);
    
    // Card values
    doc.fontSize(14)
        .font('Helvetica-Bold');
    
    cards.forEach((card, idx) => {
        const x = margin + (idx * (cardWidth + 20));
        doc.fillColor(card.color)
            .text(formatRupiah(card.value), x, doc.y, {
                width: cardWidth,
                align: 'center'
            });
    });
    
    doc.moveDown(1.5);
    drawDivider(doc, doc.y - 8, margin, pageWidth);
    doc.moveDown(0.8);
    
    return doc;
}

/**
 * Draw table header
 */
function drawTableHeader(doc, margin, pageWidth) {
    const contentWidth = pageWidth - (margin * 2);
    const columns = {
        no: margin,
        date: margin + 40,
        type: margin + 95,
        category: margin + 155,
        description: margin + 215,
        amount: pageWidth - margin - 75
    };
    
    // Background
    doc.rect(margin, doc.y, contentWidth, 20)
        .fill('#F9FAFB');
    
    // Headers
    doc.fontSize(7.5)
        .font('Helvetica-Bold')
        .fillColor('#374151');
    
    doc.text('No', columns.no + 5, doc.y + 6);
    doc.text('Tanggal', columns.date + 3, doc.y + 6);
    doc.text('Tipe', columns.type + 3, doc.y + 6);
    doc.text('Kategori', columns.category + 3, doc.y + 6);
    doc.text('Deskripsi', columns.description + 3, doc.y + 6);
    doc.text('Nominal', columns.amount + 3, doc.y + 6);
    
    doc.moveDown(1.6);
    
    return { columns, currentY: doc.y };
}

/**
 * Draw transaction row
 */
function drawTransactionRow(doc, transaction, index, columns, rowY, isEven) {
    const isIncome = transaction.type === 'income';
    const bgColor = isEven ? '#FFFFFF' : '#F9FAFB';
    const contentWidth = doc.page.width - 80;
    
    // Row background
    doc.rect(40, rowY - 2, contentWidth, 16)
        .fill(bgColor);
    
    // No
    doc.fillColor('#374151')
        .fontSize(7)
        .font('Helvetica')
        .text((index + 1).toString(), columns.no + 5, rowY);
    
    // Date
    doc.text(formatTanggal(transaction.created_at), columns.date + 3, rowY);
    
    // Type with color
    doc.fillColor(isIncome ? '#10B981' : '#EF4444')
        .text(isIncome ? 'Masuk' : 'Keluar', columns.type + 3, rowY);
    
    // Category & Description
    doc.fillColor('#374151');
    doc.text((transaction.category || '-').substring(0, 14), columns.category + 3, rowY);
    doc.text((transaction.description || '-').substring(0, 20), columns.description + 3, rowY);
    
    // Amount (right aligned)
    const amount = formatRupiah(transaction.amount);
    const amountWidth = doc.widthOfString(amount);
    doc.fillColor(isIncome ? '#10B981' : '#EF4444')
        .text(amount, columns.amount + (70 - amountWidth), rowY);
    
    return doc;
}

/**
 * Draw footer with page numbers
 */
function drawFooter(doc, margin, pageWidth) {
    const pageCount = doc.bufferedPageRange().count;
    const pageHeight = doc.page.height;
    
    for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(7)
            .font('Helvetica')
            .fillColor('#D1D5DB');
        
        doc.text('UangKu', margin, pageHeight - 25);
        doc.text(`Page ${i + 1} of ${pageCount}`,
            pageWidth - margin - 40,
            pageHeight - 25
        );
    }
    
    return doc;
}

// ==========================================
// MAIN PDF GENERATION ROUTE
// ==========================================

router.get('/pdf', authenticate, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Build query
        let query = supabase
            .from('transactions')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: true });
        
        if (startDate && endDate) {
            query = query
                .gte('created_at', startDate)
                .lte('created_at', endDate + 'T23:59:59');
        }
        
        // Fetch transactions
        const { data: transactions, error } = await query;
        if (error) throw error;
        
        // Get user profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', req.user.id)
            .single();
        
        // Prepare data
        const summary = calculateSummary(transactions);
        const userName = profile?.name || req.user.email;
        const periodeText = (startDate && endDate)
            ? `${formatTanggal(startDate)} - ${formatTanggal(endDate)}`
            : 'All Transactions';
        const printDate = formatTanggal(new Date());
        
        // PDF Configuration
        const margin = 40;
        const pageWidth = 595; // A4 width in points
        const doc = new PDFDocument({
            margin,
            size: 'A4',
            layout: 'portrait',
            info: {
                Title: 'Financial Report',
                Author: 'UangKu',
                Subject: 'Transaction Report'
            }
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=laporan_keuangan_${Date.now()}.pdf`);
        doc.pipe(res);
        
        // Generate PDF
        drawHeader(doc, { margin, pageWidth, periodeText, printDate, userName });
        drawSummaryCards(doc, summary, margin, pageWidth);
        
        // Transactions section
        doc.fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#1A1A2E')
            .text('Transaction History');
        
        doc.fontSize(7.5)
            .font('Helvetica')
            .fillColor('#9CA3AF')
            .text(`${transactions.length} transactions`,
                pageWidth - margin - 60,
                doc.y - 8
            );
        doc.moveDown(0.8);
        
        if (transactions.length === 0) {
            doc.fontSize(10)
                .fillColor('#9CA3AF')
                .text('No transactions found.', {
                    align: 'center',
                    margin: 0
                });
        } else {
            const { columns, currentY } = drawTableHeader(doc, margin, pageWidth);
            let rowY = currentY;
            
            transactions.forEach((transaction, idx) => {
                const isEven = idx % 2 === 0;
                drawTransactionRow(doc, transaction, idx, columns, rowY, isEven);
                rowY += 14;
                
                // Page break if needed
                if (rowY > 700) {
                    doc.addPage();
                    doc.fontSize(10)
                        .font('Helvetica-Bold')
                        .fillColor('#1A1A2E')
                        .text('Transaction History (Continued)');
                    doc.moveDown(0.5);
                    
                    const newHeader = drawTableHeader(doc, margin, pageWidth);
                    rowY = newHeader.currentY;
                }
            });
            
            doc.moveDown(0.5);
            
            // Summary row
            doc.rect(margin, doc.y, pageWidth - (margin * 2), 20)
                .fill('#F3F4F6');
            
            doc.fontSize(8)
                .font('Helvetica-Bold')
                .fillColor('#1F2937')
                .text('TOTAL', margin + 10, doc.y + 6);
            
            const incomeStr = formatRupiah(summary.totalIncome);
            const expenseStr = formatRupiah(summary.totalExpense);
            const balanceStr = formatRupiah(summary.balance);
            
            const incomeWidth = doc.widthOfString(incomeStr);
            const expenseWidth = doc.widthOfString(expenseStr);
            
            doc.fillColor('#10B981')
                .text(incomeStr, columns.amount - 105 + (70 - incomeWidth), doc.y + 6);
            doc.fillColor('#EF4444')
                .text(expenseStr, columns.amount - 50 + (70 - expenseWidth), doc.y + 6);
            doc.fillColor('#3B82F6')
                .text(balanceStr, columns.amount + 3, doc.y + 6);
        }
        
        drawFooter(doc, margin, pageWidth);
        doc.end();
        
    } catch (err) {
        console.error('PDF generation error:', err);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to generate PDF report',
                details: err.message
            });
        }
    }
});

module.exports = router;
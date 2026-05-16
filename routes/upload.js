const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Setup multer (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Upload foto untuk transaksi
router.post('/photo/:transactionId', authenticate, upload.single('photo'), async (req, res) => {
    const { transactionId } = req.params;
    const file = req.file;
    
    if (!file) {
        return res.status(400).json({ error: 'Tidak ada file yang diupload' });
    }
    
    // Generate nama file unik
    const fileName = `${req.user.id}/${transactionId}_${Date.now()}.jpg`;
    
    // Upload ke Supabase Storage
    const { data, error } = await supabase.storage
        .from('transaction-photos')
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            cacheControl: '3600'
        });
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    
    // Dapatkan public URL
    const { data: { publicUrl } } = supabase.storage
        .from('transaction-photos')
        .getPublicUrl(fileName);
    
    // Update transaction dengan photo_url
    await supabase
        .from('transactions')
        .update({ photo_url: publicUrl })
        .eq('id', transactionId)
        .eq('user_id', req.user.id);
    
    res.json({ message: 'Upload sukses!', url: publicUrl });
});

// Hapus foto
router.delete('/photo/:transactionId', authenticate, async (req, res) => {
    const { transactionId } = req.params;
    
    // Dapatkan photo_url dulu
    const { data: transaction } = await supabase
        .from('transactions')
        .select('photo_url')
        .eq('id', transactionId)
        .eq('user_id', req.user.id)
        .single();
    
    if (transaction?.photo_url) {
        // Extract file path dari URL
        const urlParts = transaction.photo_url.split('/');
        const filePath = urlParts.slice(urlParts.indexOf('transaction-photos') + 1).join('/');
        
        // Hapus dari storage
        await supabase.storage
            .from('transaction-photos')
            .remove([filePath]);
        
        // Hapus URL dari database
        await supabase
            .from('transactions')
            .update({ photo_url: null })
            .eq('id', transactionId);
    }
    
    res.json({ message: 'Foto berhasil dihapus' });
});

module.exports = router;
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email wajib diisi' });
    }
    
    // Redirect ke halaman reset password (bisa pakai URL Vercel)
    const redirectTo = process.env.CLIENT_URL || 'https://uangku.vercel.app';
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${redirectTo}/reset-password.html`
    });
    
    if (error) {
        console.error('Reset password error:', error);
        return res.status(400).json({ error: error.message });
    }
    
    res.json({ message: 'Link reset password telah dikirim ke email Anda' });
});

module.exports = router;
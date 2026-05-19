const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

router.post('/register', async (req, res) => {
    const { name, email, password, phone } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { name: name || '', phone: phone || '' }
        }
    });
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    
    if (data.user) {
        await supabase
            .from('profiles')
            .upsert({ 
                id: data.user.id, 
                name: name || 'User', 
                phone: phone || '', 
                is_admin: false 
            });
    }
    
    res.json({ 
        message: 'Register sukses! Silakan login.',
        user: { id: data.user.id, email: data.user.email }
    });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', data.user.id)
        .single();
    
    const isAdmin = profile?.is_admin || false;
    
    res.json({ 
        message: 'Login sukses',
        token: data.session.access_token,
        user: { 
            id: data.user.id, 
            email: data.user.email,
            is_admin: isAdmin 
        }
    });
});

module.exports = router;
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const authenticate = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token tidak ditemukan' });
    }
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
        return res.status(401).json({ error: 'Token tidak valid' });
    }
    
    req.user = user;
    next();
};

const isAdmin = async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', req.user.id)
            .single();
        
        if (error || !data?.is_admin) {
            return res.status(403).json({ error: 'Akses ditolak. Hanya admin.' });
        }
        
        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = { authenticate, isAdmin };
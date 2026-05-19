const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticate, isAdmin } = require('../middleware/auth');
const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

router.get('/users', authenticate, isAdmin, async (req, res) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, name, phone, is_admin');
    
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

router.get('/stats', authenticate, isAdmin, async (req, res) => {
    const { data, error } = await supabase
        .from('transactions')
        .select('user_id, type, amount');
    
    if (error) return res.status(400).json({ error: error.message });
    
    const userStats = {};
    data.forEach(t => {
        if (!userStats[t.user_id]) userStats[t.user_id] = { income: 0, expense: 0 };
        if (t.type === 'income') userStats[t.user_id].income += parseFloat(t.amount);
        else userStats[t.user_id].expense += parseFloat(t.amount);
    });
    
    res.json(userStats);
});

router.get('/user-transactions/:userId', authenticate, isAdmin, async (req, res) => {
    const { userId } = req.params;
    
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

module.exports = router;
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

router.get('/pdf', authenticate, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
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
        
        const { data: transactions, error } = await query;
        if (error) throw error;
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', req.user.id)
            .single();
        
        res.json({
            success: true,
            transactions: transactions,
            userName: profile?.name || req.user.email,
            startDate,
            endDate
        });
        
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

module.exports = router;
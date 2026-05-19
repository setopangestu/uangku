const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

router.post('/', authenticate, async (req, res) => {
    const { type, amount, category, description } = req.body;
    
    if (!type || !amount) {
        return res.status(400).json({ error: 'Type dan amount wajib diisi' });
    }
    
    const { data, error } = await supabase
        .from('transactions')
        .insert([{
            user_id: req.user.id,
            type,
            amount: parseFloat(amount),
            category: category || 'Lainnya',
            description: description || '',
            created_at: new Date()
        }])
        .select();
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Transaksi berhasil ditambah', data: data[0] });
});

router.get('/', authenticate, async (req, res) => {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false });
    
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

router.put('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { type, amount, category, description } = req.body;
    
    const { data, error } = await supabase
        .from('transactions')
        .update({
            type,
            amount: parseFloat(amount),
            category: category || 'Lainnya',
            description: description || ''
        })
        .eq('id', id)
        .eq('user_id', req.user.id)
        .select();
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Transaksi berhasil diupdate', data: data[0] });
});

router.delete('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    
    const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', req.user.id);
    
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Transaksi berhasil dihapus' });
});

router.get('/summary', authenticate, async (req, res) => {
    const { data, error } = await supabase
        .from('transactions')
        .select('type, amount')
        .eq('user_id', req.user.id);
    
    if (error) return res.status(400).json({ error: error.message });
    
    let totalIncome = 0, totalExpense = 0;
    data.forEach(t => {
        if (t.type === 'income') totalIncome += parseFloat(t.amount);
        else totalExpense += parseFloat(t.amount);
    });
    
    res.json({ total_income: totalIncome, total_expense: totalExpense, balance: totalIncome - totalExpense });
});

module.exports = router;
// scripts/createAdmin.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

async function createAdmin() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    
    if (!email || !password) {
        console.log('❌ Isi ADMIN_EMAIL dan ADMIN_PASSWORD di .env dulu!');
        return;
    }
    
    console.log(`📧 Membuat admin: ${email}`);
    
    // 1. Cek apakah user sudah ada
    const { data: existingUser, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (!signInError && existingUser?.user) {
        console.log('⚠️ User sudah ada, memperbarui role menjadi admin...');
        
        // Update profile jadi admin
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ is_admin: true })
            .eq('id', existingUser.user.id);
        
        if (updateError) {
            console.log('❌ Gagal update admin:', updateError.message);
        } else {
            console.log('✅ User berhasil dijadikan admin!');
        }
        return;
    }
    
    // 2. Buat user baru
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { 
                name: 'Super Admin', 
                phone: 'admin',
                is_admin: true 
            }
        }
    });
    
    if (error) {
        console.log('❌ Gagal membuat admin:', error.message);
        return;
    }
    
    if (data.user) {
        // 3. Update profile jadi admin
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ is_admin: true, name: 'Super Admin' })
            .eq('id', data.user.id);
        
        if (profileError) {
            console.log('❌ Gagal set admin:', profileError.message);
        } else {
            console.log('✅ Admin berhasil dibuat!');
            console.log(`📧 Email: ${email}`);
            console.log(`🔑 Password: ${password}`);
        }
    }
}

createAdmin();
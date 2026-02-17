
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ugjnylhmjkyagnyxvenk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnam55bGhtamt5YWdueXh2ZW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MzQ3NzQsImV4cCI6MjA4NjQxMDc3NH0.mdOKBeWqROvllIugrvf4YxrHxq2_zP8M4jg6ovndimc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestUser() {
    console.log('Tentando criar usuário alternativo pois a@a.com falhou...');

    const email = 'teste@teste.com';
    const password = '123456'; // Senha válida (min 6)

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        console.error('Erro ao criar teste@teste.com:', error.message);
    } else {
        console.log('✔ Usuário criado com sucesso!');
        console.log('Email:', email);
        console.log('Senha:', password);
        console.log('ID:', data.user?.id);
    }
}

createTestUser();

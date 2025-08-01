const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const mime = require('mime-types');

// 🔐 Chave da OpenAI
const OPENAI_API_KEY = 'SUA_API_KEY_AQUI';

const client = new Client();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const userState = {};

client.on('qr', qr => {
    console.log('📱 Escaneie o QR code abaixo para conectar:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot conectado ao WhatsApp!');
});

async function transcreverAudioComWhisper(caminhoDoArquivo, apiKey) {
    const form = new FormData();
    const mimeType = mime.lookup(caminhoDoArquivo) || 'audio/ogg';

    form.append('file', fs.createReadStream(caminhoDoArquivo), {
        filename: caminhoDoArquivo,
        contentType: mimeType
    });
    form.append('model', 'whisper-1');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${apiKey}`
        }
    });

    return response.data.text;
}

const responses = {
    '1': '*PRECISA DE UM ORÇAMENTO?*\n\nPor favor, informe o tipo de serviço:',
    
    '2': '*DESEJA PARTICIPAR DO NOSSO TIME OU FAZER UMA DIÁRIA?*\n\nDigite:\n1 - Participar do time\n2 - Fazer uma diária',
    
    '3': '*PRECISA DE AJUDA COM SUA FATURA OU NF?*\n📞 https://wa.link/vh7umc - *Carina*',
    
    '5': '*DESEJA SER NOSSO FORNECEDOR?*\nEnvie seus dados e proposta pelo e-mail: comercial@espacolimpo.com.br'
};

client.on('message', async msg => {
    try {
        if (!msg || !msg.from || !msg.from.endsWith('@c.us')) return;

        const user = msg.from;
        const body = msg.body?.trim().toLowerCase();
        let state = userState[user] || { step: 'main' };

        console.log(`Usuário: ${user} - modoHumano: ${state.modoHumano}`);

        if (body === 'assumir') {
            state.modoHumano = true;
            userState[user] = state;
            console.log(`Modo humano ativado para ${user}`);
            await msg.reply('🤖 O bot parou. *Modo humano ativado*.');
            return;
        }

        if (body === 'bot') {
            state.modoHumano = false;
            userState[user] = state;
            console.log(`Modo humano desativado para ${user}`);
            await msg.reply('✅ O bot voltou a funcionar normalmente.');
            return;
        }

        if (state.modoHumano) return;

        if (msg.hasMedia && msg.type === 'audio') {
            const media = await msg.downloadMedia();
            const filename = `audio-${Date.now()}.ogg`;

            if (!fs.existsSync('./audios')) fs.mkdirSync('./audios');
            fs.writeFileSync(`./audios/${filename}`, media.data, { encoding: 'base64' });

            await msg.reply('Agradecemos o seu áudio ☺\n\nEstamos transcrevendo... aguarde um momento!');

            try {
                const transcricao = await transcreverAudioComWhisper(`./audios/${filename}`, OPENAI_API_KEY);
                await msg.reply(`📝 Transcrição do seu áudio:\n\n${transcricao}`);
            } catch (err) {
                console.error('Erro na transcrição:', err.response?.data || err.message);
                await msg.reply('⚠️ Ocorreu um erro ao transcrever seu áudio.');
            }

            return;
        }

        if (/^(menu|oi|olá|ola|tudo|bom dia|boa tarde|boa noite)/i.test(body)) {
            userState[user] = { step: 'main' };
            await delay(300);
            await msg.reply(
`Olá! Sou a *Lorena*, assistente virtual da empresa *Espaço Limpo* 🤖
Como posso ajudá-lo hoje? Digite uma das opções abaixo:

*1 - PRECISA DE UM ORÇAMENTO?*  

*2 - PARTICIPAR DO NOSSO TIME OU FAZER UMA DIÁRIA*  

*3 - AJUDA COM FATURA OU NOTA FISCAL*  

*4 - JÁ É NOSSO CLIENTE E PRECISA DE ATENDIMENTO*  

*5 - DESEJA SER NOSSO FORNECEDOR*

*Para voltar ao menu, digite:* menu`);
            return;
        }

        switch (state.step) {
            case 'main':
                if (body === '1') {
                    state.step = 'orcamento_servico';
                    userState[user] = state;
                    await msg.reply('*1.1* - Qual tipo de serviço você procura?\n\n1 - Limpeza\n2 - Controle de acesso\n3 - Jardinagem\n4 - Zeladoria');
                } else if (body === '2') {
                    state.step = 'menu_recrutamento';
                    userState[user] = state;
                    await msg.reply('*Deseja:*\n1 - Participar do time\n2 - Fazer uma diária');
                } else if (body === '4') {
                    state.step = 'atendimento_tipo';
                    userState[user] = state;
                    await msg.reply(
                        'Como funciona o seu atendimento?\n\n' +
                        '1 - Um colaborador vai até o local, realiza o serviço e vai embora?\n' +
                        '2 - Ou o colaborador fica fixo no local durante o expediente?\n\n' +
                        'Por favor, responda com *1* ou *2*.'
                    );
                } else if (responses[body]) {
                    await msg.reply(responses[body]);
                } else {
                    await msg.reply('Desculpe, não entendi. Digite *menu* para ver as opções.');
                }
                break;

            case 'atendimento_tipo':
                if (body === '1') {
                    await msg.reply('📞 *Chame o William Jesus*:\nhttps://l1nq.com/ChameWilliamenoWhatsApp');
                } else if (body === '2') {
                    await msg.reply('📞 *Chame o Rodrigo Ciccone*:\nhttps://l1nq.com/ChameRodrigonoWhatsApp');
                } else {
                    await msg.reply('Por favor, responda com *1* ou *2*.');
                    return;
                }
                delete userState[user];
                break;

            case 'menu_recrutamento':
                if (body === '1') {
                    state.step = 'vaga';
                    userState[user] = state;
                    await msg.reply('Qual vaga você deseja?\n\n1 - Limpeza\n2 - Controlador de acesso\n3 - Jardinagem\n4 - Zeladoria');
                } else if (body === '2') {
                    state.step = 'diaria_info';
                    userState[user] = state;
                    await msg.reply('Envie:\n\n📝 Seu nome\n📧 E-mail\n📅 Data desejada da diária');
                } else {
                    await msg.reply('Responda com *1* ou *2*.');
                }
                break;

            case 'vaga':
                if (['1', '2', '3', '4'].includes(body)) {
                    state.step = 'aguardando_curriculo';
                    userState[user] = state;
                    await msg.reply('Envie:\n📎 Currículo em PDF\n📝 Nome completo\n📧 E-mail de contato');
                } else {
                    await msg.reply('Escolha: 1, 2, 3 ou 4.');
                }
                break;

            case 'aguardando_curriculo':
            case 'diaria_info':
                await msg.reply('✅ Obrigado! Um de nossos consultores entrará em contato em breve.');
                delete userState[user];
                break;

            case 'orcamento_servico':
                if (body === '1') {
                    state.step = 'orcamento_limpeza';
                    userState[user] = state;
                    await msg.reply('*1.1.2* - Qual o tipo de limpeza?\n\n1 - Escritório\n2 - Pós-obras\n3 - Pré-mudança\n4 - Fachada');
                } else {
                    state.step = 'coleta_dados_basicos';
                    userState[user] = state;
                    await msg.reply('Informe:\n\nNome completo\nE-mail\nNome da empresa\nCNPJ');
                }
                break;

            case 'orcamento_limpeza':
                state.step = 'coleta_dados_basicos';
                userState[user] = state;
                await msg.reply('Beleza! Agora informe:\n\nNome completo\nE-mail\nEmpresa\nCNPJ');
                break;

            case 'coleta_dados_basicos':
                state.step = 'orcamento_recorrencia';
                userState[user] = state;
                await msg.reply('Esse atendimento será:\n\n1 - Único\n2 - Recorrente');
                break;

            case 'orcamento_recorrencia':
                state.step = 'orcamento_midia';
                userState[user] = state;
                await msg.reply('Possui fotos ou vídeo do local?\n\n1 - Sim\n2 - Não');
                break;

            case 'orcamento_midia':
                if (body === '1') {
                    state.step = 'aguardando_midia';
                    userState[user] = state;
                    await msg.reply('Envie as fotos ou vídeos nesta conversa.');
                } else {
                    state.step = 'orcamento_area';
                    userState[user] = state;
                    await msg.reply('Qual a metragem aproximada?\n\n0-50m²\n51-100m²\n101-200m²\nAcima de 200m²');
                }
                break;

            case 'aguardando_midia':
            case 'orcamento_area':
                await msg.reply('✅ Obrigado pelo contato!\nNosso time retornará em breve.');
                delete userState[user];
                break;

            default:
                await msg.reply('⚠️ Algo deu errado. Digite *menu* para recomeçar.');
                delete userState[user];
                break;
        }

    } catch (err) {
        console.error('❌ Erro:', err);
    }
});

client.initialize();

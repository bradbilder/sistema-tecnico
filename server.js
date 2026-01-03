const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'sua-chave-secreta-super-segura-2024';

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Servir arquivos estáticos
app.use(express.static('public'));

// Inicializar SQLite com arquivo (não em memória)
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) {
    console.error('❌ Erro ao conectar SQLite:', err);
  } else {
    console.log('✅ SQLite conectado (arquivo: database.db)');
    inicializarBancoDados();
  }
});

// Funções auxiliares
const executarSQL = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('❌ Erro SQL:', sql, err);
        reject(err);
      }
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const obterDados = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('❌ Erro SQL:', sql, err);
        reject(err);
      }
      else resolve(rows || []);
    });
  });
};

const obterUm = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('❌ Erro SQL:', sql, err);
        reject(err);
      }
      else resolve(row);
    });
  });
};

// Middleware de autenticação
const verificarToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ erro: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido' });
  }
};

// ===== INICIALIZAR BANCO DE DADOS =====
function inicializarBancoDados() {
  db.serialize(() => {
    // Tabela de Usuários
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      funcao TEXT,
      data_criacao TEXT,
      ativo INTEGER DEFAULT 1
    )`, (err) => {
      if (!err) console.log('📋 Tabela usuarios criada');
    });

    // Tabela de Clientes
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      email TEXT,
      telefone TEXT,
      empresa TEXT,
      endereco TEXT,
      cnpj TEXT,
      tipo_contato TEXT,
      data_cadastro TEXT,
      status TEXT DEFAULT 'ativo',
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`, (err) => {
      if (!err) console.log('📋 Tabela clientes criada');
    });

    // Tabela de Chamados
    db.run(`CREATE TABLE IF NOT EXISTS chamados (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      cliente_id TEXT NOT NULL,
      titulo TEXT NOT NULL,
      descricao TEXT,
      categoria TEXT,
      prioridade TEXT DEFAULT 'média',
      status TEXT DEFAULT 'aberto',
      data_abertura TEXT,
      data_fechamento TEXT,
      data_prazo TEXT,
      tecnico TEXT,
      tempo_estimado INTEGER,
      tempo_gasto INTEGER,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    )`, (err) => {
      if (!err) console.log('📋 Tabela chamados criada');
    });

    // Tabela de Serviços
    db.run(`CREATE TABLE IF NOT EXISTS servicos (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco REAL,
      tempo_medio INTEGER,
      categoria TEXT,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`, (err) => {
      if (!err) console.log('📋 Tabela servicos criada');
    });

    // Tabela de Agendamentos
    db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      cliente_id TEXT NOT NULL,
      servico_id TEXT,
      data_agendada TEXT,
      hora TEXT,
      local TEXT,
      status TEXT DEFAULT 'agendado',
      notas TEXT,
      confirmado INTEGER DEFAULT 0,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY(cliente_id) REFERENCES clientes(id),
      FOREIGN KEY(servico_id) REFERENCES servicos(id)
    )`, (err) => {
      if (!err) console.log('📋 Tabela agendamentos criada');
    });

    // Tabela de Pagamentos
    db.run(`CREATE TABLE IF NOT EXISTS pagamentos (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      cliente_id TEXT NOT NULL,
      chamado_id TEXT,
      valor REAL,
      data_pagamento TEXT,
      data_vencimento TEXT,
      metodo TEXT,
      status TEXT DEFAULT 'pendente',
      descricao TEXT,
      recibo TEXT,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY(cliente_id) REFERENCES clientes(id),
      FOREIGN KEY(chamado_id) REFERENCES chamados(id)
    )`, (err) => {
      if (!err) console.log('📋 Tabela pagamentos criada');
    });

    // Tabela de Manutenções
    db.run(`CREATE TABLE IF NOT EXISTS manutencoes (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      cliente_id TEXT NOT NULL,
      tipo TEXT,
      data_agendada TEXT,
      frequencia TEXT,
      ultima_execucao TEXT,
      proxima_execucao TEXT,
      checklist TEXT,
      status TEXT DEFAULT 'programado',
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    )`, (err) => {
      if (!err) console.log('📋 Tabela manutencoes criada');
    });

    // Tabela de Estoque
    db.run(`CREATE TABLE IF NOT EXISTS estoque (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      categoria TEXT,
      quantidade INTEGER,
      preco_unitario REAL,
      fornecedor TEXT,
      data_entrada TEXT,
      nivel_minimo INTEGER,
      localizacao TEXT,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`, (err) => {
      if (!err) console.log('📋 Tabela estoque criada');
    });

    // Tabela de Anotações
    db.run(`CREATE TABLE IF NOT EXISTS anotacoes (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL,
      titulo TEXT NOT NULL,
      conteudo TEXT,
      data_criacao TEXT,
      prioridade TEXT DEFAULT 'normal',
      concluida INTEGER DEFAULT 0,
      FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`, (err) => {
      if (!err) console.log('📋 Tabela anotacoes criada');
    });

    // Inserir usuário padrão
    const senhaHash = bcrypt.hashSync('admin123', 10);
    db.run(
      `INSERT OR IGNORE INTO usuarios (id, nome, email, senha, funcao, data_criacao, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'admin-001',
        'Administrador',
        'admin@tecnico.com',
        senhaHash,
        'administrador',
        new Date().toISOString(),
        1
      ],
      (err) => {
        if (!err) console.log('👤 Usuário padrão criado (admin@tecnico.com / admin123)');
      }
    );

    console.log('✅ Banco de dados inicializado!');
  });
}

// ===== ROTAS DE AUTENTICAÇÃO =====
app.post('/api/auth/registrar', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    // Validar dados
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, email e senha são obrigatórios' });
    }

    // Verificar se email já existe
    const usuarioExistente = await obterUm('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (usuarioExistente) {
      return res.status(400).json({ erro: 'Email já cadastrado' });
    }

    const id = uuidv4();
    const senhaHash = bcrypt.hashSync(senha, 10);
    const data_criacao = new Date().toISOString();

    await executarSQL(
      'INSERT INTO usuarios (id, nome, email, senha, funcao, data_criacao, ativo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, nome, email, senhaHash, 'usuario', data_criacao, 1]
    );

    res.json({ sucesso: true, id, mensagem: 'Usuário registrado com sucesso!' });
  } catch (err) {
    console.error('Erro ao registrar:', err);
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    const usuario = await obterUm('SELECT * FROM usuarios WHERE email = ?', [email]);

    if (!usuario) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const senhaValida = bcrypt.compareSync(senha, usuario.senha);

    if (!senhaValida) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, funcao: usuario.funcao },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      sucesso: true,
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        funcao: usuario.funcao
      }
    });
  } catch (err) {
    console.error('Erro ao fazer login:', err);
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS CLIENTES (com autenticação) =====
app.post('/api/clientes', verificarToken, async (req, res) => {
  try {
    const { nome, email, telefone, empresa, endereco, cnpj, tipo_contato } = req.body;
    const id = uuidv4();
    const data_cadastro = new Date().toISOString();

    if (!nome) {
      return res.status(400).json({ erro: 'Nome é obrigatório' });
    }

    await executarSQL(
      `INSERT INTO clientes (id, usuario_id, nome, email, telefone, empresa, endereco, cnpj, tipo_contato, data_cadastro, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.usuario.id, nome, email, telefone, empresa, endereco, cnpj, tipo_contato, data_cadastro, 'ativo']
    );

    res.json({ sucesso: true, id, mensagem: 'Cliente cadastrado com sucesso!' });
  } catch (err) {
    console.error('Erro ao cadastrar cliente:', err);
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/clientes', verificarToken, async (req, res) => {
  try {
    const clientes = await obterDados(
      'SELECT * FROM clientes WHERE usuario_id = ? ORDER BY data_cadastro DESC',
      [req.usuario.id]
    );
    res.json(clientes);
  } catch (err) {
    console.error('Erro ao buscar clientes:', err);
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/clientes/:id', verificarToken, async (req, res) => {
  try {
    const cliente = await obterUm(
      'SELECT * FROM clientes WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );
    if (cliente) {
      res.json(cliente);
    } else {
      res.status(404).json({ erro: 'Cliente não encontrado' });
    }
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/clientes/:id', verificarToken, async (req, res) => {
  try {
    const { nome, email, telefone, empresa, endereco, cnpj, tipo_contato, status } = req.body;
    await executarSQL(
      `UPDATE clientes SET nome=?, email=?, telefone=?, empresa=?, endereco=?, cnpj=?, tipo_contato=?, status=?
       WHERE id=? AND usuario_id=?`,
      [nome, email, telefone, empresa, endereco, cnpj, tipo_contato, status, req.params.id, req.usuario.id]
    );
    res.json({ sucesso: true, mensagem: 'Cliente atualizado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/clientes/:id', verificarToken, async (req, res) => {
  try {
    await executarSQL('DELETE FROM clientes WHERE id=? AND usuario_id=?', [req.params.id, req.usuario.id]);
    res.json({ sucesso: true, mensagem: 'Cliente deletado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS CHAMADOS =====
app.post('/api/chamados', verificarToken, async (req, res) => {
  try {
    const { cliente_id, titulo, descricao, categoria, prioridade, data_prazo } = req.body;
    const id = uuidv4();
    const data_abertura = new Date().toISOString();

    if (!cliente_id || !titulo) {
      return res.status(400).json({ erro: 'Cliente e título são obrigatórios' });
    }

    await executarSQL(
      `INSERT INTO chamados (id, usuario_id, cliente_id, titulo, descricao, categoria, prioridade, status, data_abertura, data_prazo, tecnico)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.usuario.id, cliente_id, titulo, descricao, categoria, prioridade, 'aberto', data_abertura, data_prazo, req.usuario.nome]
    );

    res.json({ sucesso: true, id, mensagem: 'Chamado aberto com sucesso!' });
  } catch (err) {
    console.error('Erro ao abrir chamado:', err);
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/chamados', verificarToken, async (req, res) => {
  try {
    const chamados = await obterDados(`
      SELECT c.*, cl.nome as cliente_nome
      FROM chamados c
      LEFT JOIN clientes cl ON c.cliente_id = cl.id
      WHERE c.usuario_id = ?
      ORDER BY c.data_abertura DESC
    `, [req.usuario.id]);
    res.json(chamados);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/chamados/:id', verificarToken, async (req, res) => {
  try {
    const { titulo, descricao, prioridade, status, data_prazo, tempo_gasto } = req.body;
    const data_fechamento = status === 'fechado' ? new Date().toISOString() : null;

    await executarSQL(
      `UPDATE chamados SET titulo=?, descricao=?, prioridade=?, status=?, data_prazo=?, tempo_gasto=?, data_fechamento=?
       WHERE id=? AND usuario_id=?`,
      [titulo, descricao, prioridade, status, data_prazo, tempo_gasto, data_fechamento, req.params.id, req.usuario.id]
    );

    res.json({ sucesso: true, mensagem: 'Chamado atualizado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS SERVIÇOS =====
app.post('/api/servicos', verificarToken, async (req, res) => {
  try {
    const { nome, descricao, preco, tempo_medio, categoria } = req.body;
    const id = uuidv4();

    if (!nome) {
      return res.status(400).json({ erro: 'Nome do serviço é obrigatório' });
    }

    await executarSQL(
      'INSERT INTO servicos (id, usuario_id, nome, descricao, preco, tempo_medio, categoria) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.usuario.id, nome, descricao, preco, tempo_medio, categoria]
    );

    res.json({ sucesso: true, id, mensagem: 'Serviço cadastrado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/servicos', verificarToken, async (req, res) => {
  try {
    const servicos = await obterDados(
      'SELECT * FROM servicos WHERE usuario_id = ? ORDER BY nome',
      [req.usuario.id]
    );
    res.json(servicos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/servicos/:id', verificarToken, async (req, res) => {
  try {
    await executarSQL('DELETE FROM servicos WHERE id=? AND usuario_id=?', [req.params.id, req.usuario.id]);
    res.json({ sucesso: true, mensagem: 'Serviço deletado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS AGENDAMENTOS =====
app.post('/api/agendamentos', verificarToken, async (req, res) => {
  try {
    const { cliente_id, servico_id, data_agendada, hora, local, notas } = req.body;
    const id = uuidv4();

    if (!cliente_id || !data_agendada || !hora) {
      return res.status(400).json({ erro: 'Cliente, data e hora são obrigatórios' });
    }

    await executarSQL(
      `INSERT INTO agendamentos (id, usuario_id, cliente_id, servico_id, data_agendada, hora, local, status, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.usuario.id, cliente_id, servico_id, data_agendada, hora, local, 'agendado', notas]
    );

    res.json({ sucesso: true, id, mensagem: 'Agendamento realizado!' });
  } catch (err) {
    console.error('Erro ao agendar:', err);
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/agendamentos', verificarToken, async (req, res) => {
  try {
    const agendamentos = await obterDados(`
      SELECT a.*, cl.nome as cliente_nome, s.nome as servico_nome, s.preco
      FROM agendamentos a
      LEFT JOIN clientes cl ON a.cliente_id = cl.id
      LEFT JOIN servicos s ON a.servico_id = s.id
      WHERE a.usuario_id = ?
      ORDER BY a.data_agendada
    `, [req.usuario.id]);
    res.json(agendamentos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/agendamentos/:id', verificarToken, async (req, res) => {
  try {
    const { status, data_agendada, hora, local, notas, confirmado } = req.body;

    await executarSQL(
      `UPDATE agendamentos SET status=?, data_agendada=?, hora=?, local=?, notas=?, confirmado=? WHERE id=? AND usuario_id=?`,
      [status, data_agendada, hora, local, notas, confirmado, req.params.id, req.usuario.id]
    );

    res.json({ sucesso: true, mensagem: 'Agendamento atualizado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS PAGAMENTOS =====
app.post('/api/pagamentos', verificarToken, async (req, res) => {
  try {
    const { cliente_id, chamado_id, valor, metodo, descricao, data_vencimento } = req.body;
    const id = uuidv4();
    const data_pagamento = new Date().toISOString();

    if (!cliente_id || !valor) {
      return res.status(400).json({ erro: 'Cliente e valor são obrigatórios' });
    }

    await executarSQL(
      `INSERT INTO pagamentos (id, usuario_id, cliente_id, chamado_id, valor, data_pagamento, data_vencimento, metodo, status, descricao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.usuario.id, cliente_id, chamado_id, valor, data_pagamento, data_vencimento, metodo, 'pendente', descricao]
    );

    res.json({ sucesso: true, id, mensagem: 'Pagamento registrado!' });
  } catch (err) {
    console.error('Erro ao registrar pagamento:', err);
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/pagamentos', verificarToken, async (req, res) => {
  try {
    const pagamentos = await obterDados(`
      SELECT p.*, cl.nome as cliente_nome
      FROM pagamentos p
      LEFT JOIN clientes cl ON p.cliente_id = cl.id
      WHERE p.usuario_id = ?
      ORDER BY p.data_pagamento DESC
    `, [req.usuario.id]);
    res.json(pagamentos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/pagamentos/:id', verificarToken, async (req, res) => {
  try {
    const { status } = req.body;
    await executarSQL(
      'UPDATE pagamentos SET status=? WHERE id=? AND usuario_id=?',
      [status, req.params.id, req.usuario.id]
    );
    res.json({ sucesso: true, mensagem: 'Pagamento atualizado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS ESTOQUE =====
app.post('/api/estoque', verificarToken, async (req, res) => {
  try {
    const { nome, categoria, quantidade, preco_unitario, fornecedor, nivel_minimo, localizacao } = req.body;
    const id = uuidv4();
    const data_entrada = new Date().toISOString();

    if (!nome || !quantidade) {
      return res.status(400).json({ erro: 'Nome e quantidade são obrigatórios' });
    }

    await executarSQL(
      `INSERT INTO estoque (id, usuario_id, nome, categoria, quantidade, preco_unitario, fornecedor, data_entrada, nivel_minimo, localizacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.usuario.id, nome, categoria, quantidade, preco_unitario, fornecedor, data_entrada, nivel_minimo, localizacao]
    );

    res.json({ sucesso: true, id, mensagem: 'Item adicionado ao estoque!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/estoque', verificarToken, async (req, res) => {
  try {
    const itens = await obterDados(
      'SELECT * FROM estoque WHERE usuario_id = ? ORDER BY nome',
      [req.usuario.id]
    );
    res.json(itens);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/estoque/:id', verificarToken, async (req, res) => {
  try {
    await executarSQL('DELETE FROM estoque WHERE id=? AND usuario_id=?', [req.params.id, req.usuario.id]);
    res.json({ sucesso: true, mensagem: 'Item deletado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS MANUTENÇÕES =====
app.post('/api/manutencoes', verificarToken, async (req, res) => {
  try {
    const { cliente_id, tipo, data_agendada, frequencia, checklist } = req.body;
    const id = uuidv4();
    const proxima_execucao = calcularProximaExecucao(data_agendada, frequencia);

    if (!cliente_id || !tipo || !data_agendada) {
      return res.status(400).json({ erro: 'Cliente, tipo e data são obrigatórios' });
    }

    await executarSQL(
      `INSERT INTO manutencoes (id, usuario_id, cliente_id, tipo, data_agendada, frequencia, proxima_execucao, checklist, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.usuario.id, cliente_id, tipo, data_agendada, frequencia, proxima_execucao, checklist, 'programado']
    );

    res.json({ sucesso: true, id, mensagem: 'Manutenção agendada!' });
  } catch (err) {
    console.error('Erro ao agendar manutenção:', err);
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/manutencoes', verificarToken, async (req, res) => {
  try {
    const manutencoes = await obterDados(`
      SELECT m.*, cl.nome as cliente_nome
      FROM manutencoes m
      LEFT JOIN clientes cl ON m.cliente_id = cl.id
      WHERE m.usuario_id = ?
      ORDER BY m.proxima_execucao
    `, [req.usuario.id]);
    res.json(manutencoes);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS ANOTAÇÕES =====
app.post('/api/anotacoes', verificarToken, async (req, res) => {
  try {
    const { titulo, conteudo, prioridade } = req.body;
    const id = uuidv4();
    const data_criacao = new Date().toISOString();

    if (!titulo) {
      return res.status(400).json({ erro: 'Título é obrigatório' });
    }

    await executarSQL(
      `INSERT INTO anotacoes (id, usuario_id, titulo, conteudo, data_criacao, prioridade, concluida)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.usuario.id, titulo, conteudo, data_criacao, prioridade, 0]
    );

    res.json({ sucesso: true, id, mensagem: 'Anotação criada!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/anotacoes', verificarToken, async (req, res) => {
  try {
    const anotacoes = await obterDados(
      'SELECT * FROM anotacoes WHERE usuario_id = ? ORDER BY data_criacao DESC',
      [req.usuario.id]
    );
    res.json(anotacoes);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/anotacoes/:id', verificarToken, async (req, res) => {
  try {
    const { concluida } = req.body;
    await executarSQL(
      'UPDATE anotacoes SET concluida=? WHERE id=? AND usuario_id=?',
      [concluida, req.params.id, req.usuario.id]
    );
    res.json({ sucesso: true, mensagem: 'Anotação atualizada!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/anotacoes/:id', verificarToken, async (req, res) => {
  try {
    await executarSQL('DELETE FROM anotacoes WHERE id=? AND usuario_id=?', [req.params.id, req.usuario.id]);
    res.json({ sucesso: true, mensagem: 'Anotação deletada!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS DASHBOARD =====
app.get('/api/dashboard', verificarToken, async (req, res) => {
  try {
    const totalClientes = await obterUm(
      'SELECT COUNT(*) as total FROM clientes WHERE usuario_id = ?',
      [req.usuario.id]
    );
    const chamadosAbertos = await obterUm(
      'SELECT COUNT(*) as total FROM chamados WHERE usuario_id = ? AND status = "aberto"',
      [req.usuario.id]
    );
    const agendamentosProximos = await obterUm(
      'SELECT COUNT(*) as total FROM agendamentos WHERE usuario_id = ? AND status = "agendado"',
      [req.usuario.id]
    );
    const pagamentosPendentes = await obterUm(
      'SELECT SUM(valor) as total FROM pagamentos WHERE usuario_id = ? AND status = "pendente"',
      [req.usuario.id]
    );
    const receitaTotal = await obterUm(
      'SELECT SUM(valor) as total FROM pagamentos WHERE usuario_id = ? AND status = "pago"',
      [req.usuario.id]
    );

    res.json({
      totalClientes: totalClientes.total || 0,
      chamadosAbertos: chamadosAbertos.total || 0,
      agendamentosProximos: agendamentosProximos.total || 0,
      pagamentosPendentes: pagamentosPendentes.total || 0,
      receitaTotal: receitaTotal.total || 0
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Função auxiliar
function calcularProximaExecucao(data, frequencia) {
  const d = new Date(data);
  if (frequencia === 'mensal') d.setMonth(d.getMonth() + 1);
  if (frequencia === 'trimestral') d.setMonth(d.getMonth() + 3);
  if (frequencia === 'semestral') d.setMonth(d.getMonth() + 6);
  if (frequencia === 'anual') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}\n`);
  console.log(`📧 Email padrão: admin@tecnico.com`);
  console.log(`🔑 Senha padrão: admin123\n`);
});
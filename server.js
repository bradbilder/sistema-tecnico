const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Inicializar SQLite
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error('Erro ao conectar SQLite:', err);
  } else {
    console.log('✅ SQLite conectado (em memória)');
    inicializarBancoDados();
  }
});

// Funções auxiliares
const executarSQL = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const obterDados = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const obterUm = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Inicializar banco de dados
function inicializarBancoDados() {
  db.serialize(() => {
    // Tabela de Clientes
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT,
      telefone TEXT,
      empresa TEXT,
      endereco TEXT,
      data_cadastro TEXT,
      status TEXT DEFAULT 'ativo'
    )`);

    // Tabela de Chamados
    db.run(`CREATE TABLE IF NOT EXISTS chamados (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      titulo TEXT NOT NULL,
      descricao TEXT,
      prioridade TEXT DEFAULT 'média',
      status TEXT DEFAULT 'aberto',
      data_abertura TEXT,
      data_fechamento TEXT,
      tecnico TEXT,
      tempo_estimado INTEGER,
      FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    )`);

    // Tabela de Serviços
    db.run(`CREATE TABLE IF NOT EXISTS servicos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco REAL,
      tempo_medio INTEGER,
      categoria TEXT
    )`);

    // Tabela de Agendamentos
    db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      servico_id TEXT,
      data_agendada TEXT,
      hora TEXT,
      status TEXT DEFAULT 'agendado',
      notas TEXT,
      FOREIGN KEY(cliente_id) REFERENCES clientes(id),
      FOREIGN KEY(servico_id) REFERENCES servicos(id)
    )`);

    // Tabela de Pagamentos
    db.run(`CREATE TABLE IF NOT EXISTS pagamentos (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      chamado_id TEXT,
      valor REAL,
      data_pagamento TEXT,
      metodo TEXT,
      status TEXT DEFAULT 'pendente',
      descricao TEXT,
      FOREIGN KEY(cliente_id) REFERENCES clientes(id),
      FOREIGN KEY(chamado_id) REFERENCES chamados(id)
    )`);

    // Tabela de Manutenção
    db.run(`CREATE TABLE IF NOT EXISTS manutencoes (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      tipo TEXT,
      data_agendada TEXT,
      frequencia TEXT,
      ultima_execucao TEXT,
      proxima_execucao TEXT,
      checklist TEXT,
      status TEXT DEFAULT 'programado',
      FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    )`);

    // Tabela de Estoque
    db.run(`CREATE TABLE IF NOT EXISTS estoque (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      categoria TEXT,
      quantidade INTEGER,
      preco_unitario REAL,
      fornecedor TEXT,
      data_entrada TEXT,
      nivel_minimo INTEGER
    )`);

    console.log('📊 Tabelas criadas com sucesso!');
  });
}

// ===== ROTAS CLIENTES =====
app.post('/api/clientes', async (req, res) => {
  try {
    const { nome, email, telefone, empresa, endereco } = req.body;
    const id = uuidv4();
    const data_cadastro = new Date().toISOString();

    await executarSQL(
      'INSERT INTO clientes VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, nome, email, telefone, empresa, endereco, data_cadastro, 'ativo']
    );

    res.json({ sucesso: true, id, mensagem: 'Cliente cadastrado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await obterDados('SELECT * FROM clientes ORDER BY data_cadastro DESC');
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/clientes/:id', async (req, res) => {
  try {
    const cliente = await obterUm('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    if (cliente) {
      res.json(cliente);
    } else {
      res.status(404).json({ erro: 'Cliente não encontrado' });
    }
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/clientes/:id', async (req, res) => {
  try {
    const { nome, email, telefone, empresa, endereco, status } = req.body;
    await executarSQL(
      'UPDATE clientes SET nome=?, email=?, telefone=?, empresa=?, endereco=?, status=? WHERE id=?',
      [nome, email, telefone, empresa, endereco, status, req.params.id]
    );
    res.json({ sucesso: true, mensagem: 'Cliente atualizado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/clientes/:id', async (req, res) => {
  try {
    await executarSQL('DELETE FROM clientes WHERE id=?', [req.params.id]);
    res.json({ sucesso: true, mensagem: 'Cliente deletado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS CHAMADOS =====
app.post('/api/chamados', async (req, res) => {
  try {
    const { cliente_id, titulo, descricao, prioridade, tecnico } = req.body;
    const id = uuidv4();
    const data_abertura = new Date().toISOString();

    await executarSQL(
      'INSERT INTO chamados VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)',
      [id, cliente_id, titulo, descricao, prioridade, 'aberto', data_abertura, tecnico]
    );

    res.json({ sucesso: true, id, mensagem: 'Chamado aberto!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/chamados', async (req, res) => {
  try {
    const chamados = await obterDados(`
      SELECT c.*, cl.nome as cliente_nome 
      FROM chamados c 
      LEFT JOIN clientes cl ON c.cliente_id = cl.id
      ORDER BY c.data_abertura DESC
    `);
    res.json(chamados);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/chamados/:id', async (req, res) => {
  try {
    const { titulo, descricao, prioridade, status, tecnico } = req.body;
    const data_fechamento = status === 'fechado' ? new Date().toISOString() : null;

    await executarSQL(
      'UPDATE chamados SET titulo=?, descricao=?, prioridade=?, status=?, tecnico=?, data_fechamento=? WHERE id=?',
      [titulo, descricao, prioridade, status, tecnico, data_fechamento, req.params.id]
    );

    res.json({ sucesso: true, mensagem: 'Chamado atualizado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/chamados/cliente/:cliente_id', async (req, res) => {
  try {
    const chamados = await obterDados(
      'SELECT * FROM chamados WHERE cliente_id = ? ORDER BY data_abertura DESC',
      [req.params.cliente_id]
    );
    res.json(chamados);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS SERVIÇOS =====
app.post('/api/servicos', async (req, res) => {
  try {
    const { nome, descricao, preco, tempo_medio, categoria } = req.body;
    const id = uuidv4();

    await executarSQL(
      'INSERT INTO servicos VALUES (?, ?, ?, ?, ?, ?)',
      [id, nome, descricao, preco, tempo_medio, categoria]
    );

    res.json({ sucesso: true, id, mensagem: 'Serviço cadastrado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/servicos', async (req, res) => {
  try {
    const servicos = await obterDados('SELECT * FROM servicos ORDER BY nome');
    res.json(servicos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS AGENDAMENTOS =====
app.post('/api/agendamentos', async (req, res) => {
  try {
    const { cliente_id, servico_id, data_agendada, hora, notas } = req.body;
    const id = uuidv4();

    await executarSQL(
      'INSERT INTO agendamentos VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, cliente_id, servico_id, data_agendada, hora, 'agendado', notas]
    );

    res.json({ sucesso: true, id, mensagem: 'Agendamento realizado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/agendamentos', async (req, res) => {
  try {
    const agendamentos = await obterDados(`
      SELECT a.*, cl.nome as cliente_nome, s.nome as servico_nome, s.preco
      FROM agendamentos a
      LEFT JOIN clientes cl ON a.cliente_id = cl.id
      LEFT JOIN servicos s ON a.servico_id = s.id
      ORDER BY a.data_agendada
    `);
    res.json(agendamentos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/agendamentos/:id', async (req, res) => {
  try {
    const { status, data_agendada, hora, notas } = req.body;

    await executarSQL(
      'UPDATE agendamentos SET status=?, data_agendada=?, hora=?, notas=? WHERE id=?',
      [status, data_agendada, hora, notas, req.params.id]
    );

    res.json({ sucesso: true, mensagem: 'Agendamento atualizado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS PAGAMENTOS =====
app.post('/api/pagamentos', async (req, res) => {
  try {
    const { cliente_id, chamado_id, valor, metodo, descricao } = req.body;
    const id = uuidv4();
    const data_pagamento = new Date().toISOString();

    await executarSQL(
      'INSERT INTO pagamentos VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, cliente_id, chamado_id, valor, data_pagamento, metodo, 'pendente', descricao]
    );

    res.json({ sucesso: true, id, mensagem: 'Pagamento registrado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/pagamentos', async (req, res) => {
  try {
    const pagamentos = await obterDados(`
      SELECT p.*, cl.nome as cliente_nome
      FROM pagamentos p
      LEFT JOIN clientes cl ON p.cliente_id = cl.id
      ORDER BY p.data_pagamento DESC
    `);
    res.json(pagamentos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/pagamentos/:id', async (req, res) => {
  try {
    const { status } = req.body;
    await executarSQL(
      'UPDATE pagamentos SET status=? WHERE id=?',
      [status, req.params.id]
    );
    res.json({ sucesso: true, mensagem: 'Pagamento atualizado!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS ESTOQUE =====
app.post('/api/estoque', async (req, res) => {
  try {
    const { nome, categoria, quantidade, preco_unitario, fornecedor, nivel_minimo } = req.body;
    const id = uuidv4();
    const data_entrada = new Date().toISOString();

    await executarSQL(
      'INSERT INTO estoque VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, nome, categoria, quantidade, preco_unitario, fornecedor, data_entrada, nivel_minimo]
    );

    res.json({ sucesso: true, id, mensagem: 'Item adicionado ao estoque!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/estoque', async (req, res) => {
  try {
    const itens = await obterDados('SELECT * FROM estoque ORDER BY nome');
    res.json(itens);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS DASHBOARD =====
app.get('/api/dashboard', async (req, res) => {
  try {
    const totalClientes = await obterUm('SELECT COUNT(*) as total FROM clientes');
    const chamadosAbertos = await obterUm('SELECT COUNT(*) as total FROM chamados WHERE status = "aberto"');
    const agendamentosProximos = await obterUm('SELECT COUNT(*) as total FROM agendamentos WHERE status = "agendado"');
    const pagamentosPendentes = await obterUm('SELECT SUM(valor) as total FROM pagamentos WHERE status = "pendente"');
    
    const receita = await obterUm(`
      SELECT SUM(valor) as total FROM pagamentos WHERE status = "pago"
    `);

    res.json({
      totalClientes: totalClientes.total,
      chamadosAbertos: chamadosAbertos.total,
      agendamentosProximos: agendamentosProximos.total,
      pagamentosPendentes: pagamentosPendentes.total || 0,
      receitaTotal: receita.total || 0
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===== ROTAS MANUTENCAO =====
app.post('/api/manutencoes', async (req, res) => {
  try {
    const { cliente_id, tipo, data_agendada, frequencia, checklist } = req.body;
    const id = uuidv4();
    const proxima_execucao = calcularProximaExecucao(data_agendada, frequencia);

    await executarSQL(
      'INSERT INTO manutencoes VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)',
      [id, cliente_id, tipo, data_agendada, frequencia, proxima_execucao, checklist, 'programado']
    );

    res.json({ sucesso: true, id, mensagem: 'Manutenção agendada!' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/manutencoes', async (req, res) => {
  try {
    const manutencoes = await obterDados(`
      SELECT m.*, cl.nome as cliente_nome
      FROM manutencoes m
      LEFT JOIN clientes cl ON m.cliente_id = cl.id
      ORDER BY m.proxima_execucao
    `);
    res.json(manutencoes);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

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
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
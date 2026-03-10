# Frontend - Goofly v2

Aplicação frontend desenvolvida em React + Vite que consome a API através do API Gateway. Design responsivo alinhado à documentação de produção e imagens de exemplo.

## 🚀 Início Rápido

```bash
# Instalar dependências
npm install

# Desenvolvimento (requer API Gateway rodando, ou use VITE_DEMO_MODE=true)
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview
```

## 🎨 Design System

- **Cor primária**: #f9f506 (amarelo)
- **Fonte**: Plus Jakarta Sans
- **Ícones**: Material Symbols Outlined
- **Modo escuro**: Suportado via toggle

## 📱 Páginas

- **Dashboard** - Visão geral, próxima viagem, Trip Swipe preview, pegada global
- **Descobrir** - Tinder de Viagens (swipe de lugares)
- **Minhas Viagens** - Lista de viagens
- **Roteiro** - Criador de roteiros com timeline e mapa
- **Memórias** - Mapa mundi + diário de viagem
- **Documentos** - Cofre de documentos + lista de bagagem

## 🔧 Variáveis de Ambiente

Copie `.env.example` para `.env`. Em projetos Vite, variáveis devem ter prefixo `VITE_`:

- `VITE_API_GATEWAY_URL` - URL do API Gateway (ex: `http://localhost:3000/api`)
- `VITE_ENV` - Ambiente (development/production)
- `VITE_DEMO_MODE=true` - Modo demo sem autenticação (opcional)

## 📁 Estrutura

```
frontend/
├── src/
│   ├── components/   # common (Button, Icon), layout (Header, Sidebar)
│   ├── pages/        # Dashboard, Discover, TripList, Itinerary, Memories, Documents
│   ├── services/     # api.js, tripService, placeService, memoryService, etc.
│   ├── context/      # AuthContext, ThemeContext
│   ├── utils/        # formatters, helpers
│   ├── index.css     # Estilos globais (Tailwind)
│   ├── App.jsx
│   └── main.jsx
└── public/           # Favicon e assets estáticos
```

## 📖 Descrição das Pastas

### `src/components/`
Componentes React reutilizáveis que podem ser utilizados em múltiplas páginas.

**Organização atual:**
```
components/
├── common/           # Button, EmptyState, Icon, LoadingSpinner
└── layout/           # Header, Layout, MobileNav, Sidebar
```

**Exemplo:**
```jsx
// components/common/Button.jsx
export const Button = ({ children, onClick, variant }) => {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  );
};
```

### `src/pages/`
Páginas completas da aplicação. Cada página representa uma rota da aplicação.

**Páginas atuais:**
```
pages/
├── Dashboard.jsx
├── Discover.jsx      # Tinder de Viagens
├── Documents.jsx
├── Itinerary.jsx
├── Login.jsx
├── Memories.jsx
├── NewTrip.jsx
├── Register.jsx
├── Settings.jsx
├── TripList.jsx
```

**Exemplo com React Router:**
```jsx
// pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboardService';

export const Dashboard = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    dashboardService.getDashboard().then(setData);
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      {/* Render dashboard data */}
    </div>
  );
};
```

### `src/services/`
Camada de comunicação com a API. Todos os calls HTTP devem ser feitos através desses serviços.

**Responsabilidades:**
- Fazer requisições HTTP para o API Gateway
- Tratar erros de API
- Transformar dados quando necessário
- Gerenciar tokens de autenticação

**Serviços atuais:**
```
services/
├── api.js              # Configuração base (axios)
├── dashboardService.js
├── documentService.js
├── memoryService.js
├── placeService.js
└── tripService.js
```

**Implementação atual (Vite):**
```javascript
// services/api.js - usa import.meta.env (Vite)
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_GATEWAY_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

// services/tripService.js, placeService.js, memoryService.js, etc.
import api from './api';
export const tripService = { getAll: () => api.get('/trips'), ... };
```

### `src/utils/`
Funções utilitárias e helpers reutilizáveis.

**Exemplos:**
- Formatação de datas
- Validação de formulários
- Helpers de formatação
- Constantes da aplicação

**Exemplo:**
```
utils/
├── formatters.js     # Formatação de dados
├── validators.js     # Validações
└── constants.js      # Constantes
```

### `src/hooks/`
Custom hooks do React para lógica reutilizável.

**Exemplos:**
- `useAuth.js` - Gerenciamento de autenticação
- `useApi.js` - Hook para chamadas de API
- `useLocalStorage.js` - Persistência em localStorage
- `useDebounce.js` - Debounce de valores

**Exemplo:**
```javascript
// hooks/useApi.js
import { useState, useEffect } from 'react';

export const useApi = (apiCall) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiCall()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
};
```

### `src/context/`
Context API para gerenciamento de estado global da aplicação.

**Exemplos:**
- `AuthContext.js` - Estado de autenticação
- `ThemeContext.js` - Tema da aplicação
- `NotificationContext.js` - Notificações globais

**Exemplo:**
```javascript
// context/AuthContext.js
import { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = async (credentials) => {
    // Lógica de login
  };

  const logout = () => {
    // Lógica de logout
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

### `src/assets/`
Recursos estáticos como imagens, ícones, fontes, etc.

```
assets/
├── images/
├── icons/
└── fonts/
```

### `src/styles/`
Arquivos de estilo globais e temas.

```
styles/
├── globals.css       # Estilos globais
├── variables.css     # Variáveis CSS
└── themes/
    ├── light.css
    └── dark.css
```

### `public/`
Arquivos públicos estáticos servidos diretamente pelo servidor.

**Conteúdo comum:**
- `index.html` - HTML principal
- `favicon.ico` - Ícone do site
- `manifest.json` - PWA manifest
- `robots.txt` - Configuração de SEO

## 🚀 Setup Inicial

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento (Vite - porta 5173)
npm run dev

# Build para produção
npm run build

# Preview do build localmente
npm run preview
```

## 📝 Estrutura de um Componente

```jsx
// components/common/Card.jsx
import React from 'react';
import './Card.css';

export const Card = ({ title, children, className = '' }) => {
  return (
    <div className={`card ${className}`}>
      {title && <h2 className="card-title">{title}</h2>}
      <div className="card-content">
        {children}
      </div>
    </div>
  );
};
```

## 🔄 Fluxo de Dados

```
Component → Service → API Gateway → Backend Service
```

1. **Component**: Renderiza UI e chama services
2. **Service**: Faz requisição HTTP para API Gateway
3. **API Gateway**: Roteia para serviço backend apropriado
4. **Backend Service**: Processa e retorna dados

## ✅ Boas Práticas

- Separe componentes em componentes pequenos e reutilizáveis
- Use custom hooks para lógica compartilhada
- Centralize chamadas de API em services
- Use Context API para estado global, Redux se necessário
- Mantenha componentes funcionais e use hooks
- Implemente tratamento de erros adequado
- Use TypeScript para type safety (recomendado)
- Implemente loading states e error boundaries
- Otimize performance com React.memo e useMemo quando necessário
- Siga padrões de nomenclatura consistentes

## 🎨 Styling

Recomenda-se usar uma das seguintes abordagens:
- **CSS Modules**: Estilos scoped por componente
- **Styled Components**: CSS-in-JS
- **Tailwind CSS**: Utility-first CSS framework
- **SCSS/SASS**: Pré-processador CSS

## 📦 Dependências Recomendadas

- `react` e `react-dom`
- `react-router-dom` - Roteamento
- `axios` ou `fetch` - HTTP client
- `react-query` ou `swr` - Data fetching e cache
- `zustand` ou `redux` - State management (se necessário)

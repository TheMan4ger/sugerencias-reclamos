import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { 
  MessageSquare, Heart, Lightbulb, AlertTriangle, CheckCircle, TrendingUp, 
  Plus, Search, Printer, QrCode, Send, Smartphone, Laptop, Trash2, 
  User, Phone, Calendar, Clock, Check, X, Lock, RefreshCw, Sparkles, ExternalLink
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

const INITIAL_TICKETS = [
  {
    id: 'ticket-1', fecha: '2026-05-23T11:30:00', tipo: 'sugerencia',
    categoria: 'Variedad de Productos', productoRelacionado: 'Citrato de Magnesio DN en polvo',
    comentario: 'Me encantaría que trajeran el formato de Citrato de Magnesio en polvo de 250g. Solo encuentro las cápsulas y el de polvo rinde mucho más.',
    anonimo: false, nombre: 'Valeria Espinoza', telefono: '56987654321',
    email: 'valeria.espinosa@email.com', estado: 'pendiente', notasInternas: [], prioridad: 'media'
  },
  {
    id: 'ticket-2', fecha: '2026-05-22T16:15:00', tipo: 'felicitacion',
    categoria: 'Servicio al Cliente', productoRelacionado: '',
    comentario: 'La niña que me atendió en la caja fue un amor. Me explicó súper bien la diferencia entre el aceite de ricino y el de jojoba para las pestañas. ¡Excelente atención!',
    anonimo: false, nombre: 'Camila Sanhueza', telefono: '56912345678',
    email: 'cami.sanhueza@email.com', estado: 'resuelto',
    notasInternas: ['Se felicitó a María en la reunión semanal por su excelente asesoría técnica.'], prioridad: 'baja'
  },
  {
    id: 'ticket-3', fecha: '2026-05-21T09:45:00', tipo: 'reclamo',
    categoria: 'Calidad de Productos', productoRelacionado: 'Infusión Frutos del Bosque Sensorial',
    comentario: 'Compré una caja de infusiones frutos del bosque el lunes y tres de las bolsitas venían rotas/abiertas dentro del empaque individual. El té se desparramó.',
    anonimo: false, nombre: 'Jorge Muñoz', telefono: '56955554433',
    email: 'jorge.m@email.com', estado: 'en-revision',
    notasInternas: ['Contactado para ofrecer el cambio de la caja de té en su próxima visita.', 'Se revisará el lote en bodega.'], prioridad: 'alta'
  },
  {
    id: 'ticket-4', fecha: '2026-05-20T18:20:00', tipo: 'sugerencia',
    categoria: 'Infraestructura', productoRelacionado: '',
    comentario: 'Sería fantástico si pusieran una pequeña rampla o nivelador en la entrada para los coches de guagua o personas con movilidad reducida. Cuesta un poco entrar con el escalón.',
    anonimo: true, nombre: '', telefono: '', email: '', estado: 'pendiente', notasInternas: [], prioridad: 'baja'
  }
];

const appId = 'punto-verde-79704';
let app, auth, db;
try {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase no disponible, usando almacenamiento local.", e);
}

// ==========================================================================
// COMPONENTE RAÍZ CON RUTAS
// ==========================================================================

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública para clientes — solo el formulario */}
        <Route path="/cliente" element={<ClientePage />} />
        {/* Ruta privada para el panel de administración */}
        <Route path="/admin" element={<AdminPage />} />
        {/* Ruta raíz redirige al formulario del cliente */}
        <Route path="/" element={<Navigate to="/cliente" replace />} />
        {/* Cualquier otra ruta también redirige al cliente */}
        <Route path="*" element={<Navigate to="/cliente" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// ==========================================================================
// PÁGINA CLIENTE — Solo el formulario, sin header ni navegación
// ==========================================================================

function ClientePage() {
  const [tickets, setTickets] = useState(() => {
    try {
      const saved = localStorage.getItem('pv_tickets');
      if (saved) return JSON.parse(saved).map(t => ({ ...t, notasInternas: Array.isArray(t.notasInternas) ? t.notasInternas : [] }));
      return INITIAL_TICKETS;
    } catch (e) { return INITIAL_TICKETS; }
  });

  const [user, setUser] = useState(null);
  const [appsScriptUrl] = useState(() => { try { return localStorage.getItem('pv_apps_script_url') || ''; } catch (e) { return ''; } });

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else { await signInAnonymously(auth); }
      } catch (err) { console.error("Error auth:", err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'tickets');
    return onSnapshot(ref, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      fetched.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setTickets(fetched);
      try { localStorage.setItem('pv_tickets', JSON.stringify(fetched)); } catch (e) {}
    });
  }, [user]);

  const handleAddTicket = async (newTicket) => {
    const ticketId = `ticket-${Date.now()}`;
    const ticketWithMeta = {
      ...newTicket, fecha: new Date().toISOString(), estado: 'pendiente', notasInternas: [],
      prioridad: newTicket.tipo === 'reclamo' ? 'alta' : (newTicket.tipo === 'sugerencia' ? 'media' : 'baja')
    };
    if (appsScriptUrl && appsScriptUrl.trim().startsWith('http')) {
      fetch(appsScriptUrl.trim(), { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ticketId, ...ticketWithMeta }) }).catch(() => {});
    }
    if (user && db) {
      try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tickets'), ticketWithMeta); }
      catch (e) { setTickets(prev => [{ id: ticketId, ...ticketWithMeta }, ...prev]); }
    } else {
      setTickets(prev => [{ id: ticketId, ...ticketWithMeta }, ...prev]);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50/50 flex justify-center items-center py-8 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
        <ClientPortal onAddTicket={handleAddTicket} />
      </div>
    </div>
  );
}

// ==========================================================================
// PÁGINA ADMIN — Panel completo con header y navegación
// ==========================================================================

function AdminPage() {
  const [tickets, setTickets] = useState(() => {
    try {
      const saved = localStorage.getItem('pv_tickets');
      if (saved) return JSON.parse(saved).map(t => ({ ...t, notasInternas: Array.isArray(t.notasInternas) ? t.notasInternas : [] }));
      return INITIAL_TICKETS;
    } catch (e) { return INITIAL_TICKETS; }
  });

  const [user, setUser] = useState(null);
  const [dbConnected, setDbConnected] = useState(false);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(() => { try { return localStorage.getItem('pv_sheets_url') || ''; } catch (e) { return ''; } });
  const [appsScriptUrl, setAppsScriptUrl] = useState(() => { try { return localStorage.getItem('pv_apps_script_url') || ''; } catch (e) { return ''; } });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => { try { localStorage.setItem('pv_sheets_url', googleSheetsUrl); } catch (e) {} }, [googleSheetsUrl]);
  useEffect(() => { try { localStorage.setItem('pv_apps_script_url', appsScriptUrl); } catch (e) {} }, [appsScriptUrl]);
  useEffect(() => { try { localStorage.setItem('pv_tickets', JSON.stringify(tickets)); } catch (e) {} }, [tickets]);

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else { await signInAnonymously(auth); }
        setDbConnected(true);
      } catch (err) { setDbConnected(false); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const ref = collection(db, 'artifacts', appId, 'public', 'data', 'tickets');
    return onSnapshot(ref,
      (snap) => {
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        fetched.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        setTickets(fetched);
        setDbConnected(true);
        try { localStorage.setItem('pv_tickets', JSON.stringify(fetched)); } catch (e) {}
      },
      () => setDbConnected(false)
    );
  }, [user]);

  const handleUpdateStatus = async (id, newStatus) => {
    if (user && db) { try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', id), { estado: newStatus }); } catch (e) {} }
    else { setTickets(prev => prev.map(t => t.id === id ? { ...t, estado: newStatus } : t)); }
  };

  const handleAddNote = async (id, noteText) => {
    const target = tickets.find(t => t.id === id);
    if (!target) return;
    const updatedNotes = [...(Array.isArray(target.notasInternas) ? target.notasInternas : []), noteText];
    if (user && db) { try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', id), { notasInternas: updatedNotes }); } catch (e) {} }
    else { setTickets(prev => prev.map(t => t.id === id ? { ...t, notasInternas: updatedNotes } : t)); }
  };

  const handleDeleteTicket = async (id) => {
    if (user && db) { try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', id)); } catch (e) {} }
    else { setTickets(prev => prev.filter(t => t.id !== id)); }
  };

  const triggerResetClean = () => {
    setConfirmModal({
      isOpen: true, title: '¿Limpiar Base de Datos?',
      message: '¿Estás seguro? Esta acción elimina TODOS los tickets y no se puede deshacer.',
      onConfirm: async () => {
        if (user && db) { for (const t of tickets) { try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', t.id)); } catch (e) {} } }
        setTickets([]);
      }
    });
  };

  const handleRestoreDefaults = async () => {
    if (user && db) {
      for (const t of tickets) { try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tickets', t.id)); } catch (e) {} }
      for (const t of INITIAL_TICKETS) { const { id, ...data } = t; try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tickets'), data); } catch (e) {} }
    } else { setTickets(INITIAL_TICKETS); }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col selection:bg-emerald-500 selection:text-white">
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scroll::-webkit-scrollbar-track { background: rgba(15,23,42,0.3); border-radius: 8px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.2); border-radius: 8px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(16,185,129,0.4); }
      `}</style>

      <header className="bg-slate-950 border-b border-slate-800 py-3 px-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <div className="bg-emerald-500 p-1.5 rounded-lg text-slate-950 font-bold flex items-center justify-center">
            <span className="text-xl">🌿</span>
          </div>
          <div className="text-left">
            <h1 className="text-md font-bold tracking-tight text-white flex items-center gap-1.5">
              Punto Verde Organic
              <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-medium">
                Panel Administrativo
              </span>
            </h1>
            <p className="text-xs text-slate-400">Gestión de sugerencias, felicitaciones y reclamos</p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 shadow-xl">
          <AdminPanel
            tickets={tickets}
            onResetClean={triggerResetClean}
            onRestoreDefaults={handleRestoreDefaults}
            setConfirmModal={setConfirmModal}
            onUpdateStatus={handleUpdateStatus}
            onAddNote={handleAddNote}
            onDeleteTicket={handleDeleteTicket}
            googleSheetsUrl={googleSheetsUrl}
            setGoogleSheetsUrl={setGoogleSheetsUrl}
            appsScriptUrl={appsScriptUrl}
            setAppsScriptUrl={setAppsScriptUrl}
            dbConnected={dbConnected}
          />
        </div>
      </main>

      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-white font-black text-lg mb-2">{confirmModal.title}</h3>
            <p className="text-slate-400 text-sm mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ isOpen: false })} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all">Cancelar</button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal({ isOpen: false }); }} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// PORTAL DEL CLIENTE
// ==========================================================================

function ClientPortal({ onAddTicket }) {
  const [tipo, setTipo] = useState('sugerencia');
  const [categoria, setCategoria] = useState('Servicio al Cliente');
  const [productoRelacionado, setProductoRelacionado] = useState('');
  const [comentario, setComentario] = useState('');
  const [anonimo, setAnonimo] = useState(false);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const categoriasDisponibles = useMemo(() => {
    if (tipo === 'felicitacion') return ['Servicio al Cliente', 'Calidad de Productos', 'Variedad de Productos', 'Precios / Ofertas', 'Infraestructura', 'Otro'];
    if (tipo === 'sugerencia') return ['Variedad de Productos', 'Servicio al Cliente', 'Infraestructura', 'Precios / Ofertas', 'Empaque / Delivery', 'Otro'];
    return ['Calidad de Productos', 'Servicio al Cliente', 'Diferencia de Precios', 'Horario / Atención', 'Infraestructura', 'Otro'];
  }, [tipo]);

  useEffect(() => {
    setCategoria(categoriasDisponibles[0]);
    if (tipo === 'felicitacion') setProductoRelacionado('');
    if (tipo === 'reclamo') setAnonimo(false);
  }, [tipo, categoriasDisponibles]);

  const validateForm = () => {
    const newErrors = {};
    if (!comentario.trim()) newErrors.comentario = 'Por favor escribe tu comentario o detalle.';
    else if (comentario.trim().length < 10) newErrors.comentario = 'El mensaje debe tener al menos 10 caracteres.';
    if (!anonimo || tipo === 'reclamo') {
      if (!nombre.trim()) newErrors.nombre = 'El nombre es obligatorio.';
      if (!telefono.trim()) newErrors.telefono = 'El teléfono o WhatsApp es obligatorio.';
      else if (!/^\d{8,15}$/.test(telefono.replace(/\s+/g, ''))) newErrors.telefono = 'Ingresa un número de 8 a 15 dígitos (ej: 56912345678).';
      if (!email.trim()) newErrors.email = 'El correo electrónico es obligatorio.';
      else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Ingresa un correo electrónico válido.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    onAddTicket({
      tipo, categoria,
      productoRelacionado: (categoria === 'Calidad de Productos' || categoria === 'Variedad de Productos') ? productoRelacionado : '',
      comentario, anonimo: tipo === 'reclamo' ? false : anonimo,
      nombre: anonimo ? '' : nombre, telefono: anonimo ? '' : telefono, email: anonimo ? '' : email
    });
    setSubmitted(true);
  };

  const handleResetForm = () => {
    setTipo('sugerencia'); setCategoria('Servicio al Cliente'); setProductoRelacionado('');
    setComentario(''); setAnonimo(false); setNombre(''); setTelefono(''); setEmail('');
    setErrors({}); setSubmitted(false);
  };

  const showContactFields = !anonimo || tipo === 'reclamo';

  if (submitted) {
    return (
      <div className="flex-1 bg-emerald-50 text-slate-900 p-6 flex flex-col justify-center items-center text-center">
        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-6 shadow-lg shadow-emerald-200">
          <Check className="w-10 h-10 stroke-[3]" />
        </div>
        <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">¡Recibido con éxito!</span>
        <h3 className="text-xl font-extrabold text-slate-950">¡Muchísimas Gracias!</h3>
        <p className="text-sm text-slate-600 mt-2 max-w-sm">En <span className="font-semibold text-emerald-700">Punto Verde Organic</span> valoramos enormemente tu tiempo. Tu opinión ha sido enviada al panel central del local para su seguimiento y mejora.</p>
        {showContactFields && telefono && (
          <div className="mt-4 bg-white p-3 rounded-xl border border-emerald-100 text-xs text-slate-500 flex items-center gap-2 max-w-xs text-left">
            <div className="bg-emerald-100 p-1 rounded text-emerald-600 shrink-0"><Smartphone className="w-3.5 h-3.5" /></div>
            <span>Se ha registrado tu contacto. Nos comunicaremos contigo para darte una respuesta muy pronto.</span>
          </div>
        )}
        <button onClick={handleResetForm} className="mt-8 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-xl text-sm transition-all shadow-md w-full">Enviar otro comentario</button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white text-slate-800 flex flex-col text-left">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 text-center relative shadow-md">
        <div className="absolute top-3 right-3 text-emerald-200 animate-pulse"><Sparkles className="w-4 h-4" /></div>
        <div className="inline-flex items-center justify-center bg-white/10 w-12 h-12 rounded-full mb-2"><span className="text-2xl">🌿</span></div>
        <h2 className="text-lg font-black tracking-tight">Punto Verde Organic</h2>
        <p className="text-xs text-emerald-100 mt-0.5">Tu opinión nos ayuda a crecer de forma natural</p>
      </div>
      <form onSubmit={handleSubmit} className="p-5 flex-1 flex flex-col gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">¿Qué deseas enviarnos hoy?</label>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setTipo('felicitacion')} className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all ${tipo === 'felicitacion' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}>
              <Heart className={`w-5 h-5 mb-1 ${tipo === 'felicitacion' ? 'fill-emerald-500 text-emerald-500' : ''}`} />
              <span className="text-[10px] font-bold">Felicitación</span>
            </button>
            <button type="button" onClick={() => setTipo('sugerencia')} className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all ${tipo === 'sugerencia' ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-sm' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}>
              <Lightbulb className={`w-5 h-5 mb-1 ${tipo === 'sugerencia' ? 'fill-amber-400 text-amber-500' : ''}`} />
              <span className="text-[10px] font-bold">Sugerencia</span>
            </button>
            <button type="button" onClick={() => setTipo('reclamo')} className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all ${tipo === 'reclamo' ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-sm' : 'border-slate-100 hover:border-slate-200 text-slate-500'}`}>
              <AlertTriangle className={`w-5 h-5 mb-1 ${tipo === 'reclamo' ? 'fill-rose-100 text-rose-500' : ''}`} />
              <span className="text-[10px] font-bold">Reclamo</span>
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Área o Categoría</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 cursor-pointer">
            {categoriasDisponibles.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
          </select>
        </div>
        {(categoria === 'Calidad de Productos' || categoria === 'Variedad de Productos') && (
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Producto y/o Marca Asociada</label>
            <input type="text" placeholder="Ej: Citrato de Magnesio FNL, marca, etc." value={productoRelacionado} onChange={(e) => setProductoRelacionado(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800" />
          </div>
        )}
        <div className="flex-1 flex flex-col">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex justify-between">
            <span>Tu Mensaje</span>
            <span className="text-[10px] text-slate-400 normal-case font-normal">Mín. 10 caracteres</span>
          </label>
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)}
            placeholder={tipo === 'felicitacion' ? 'Cuéntanos qué te gustó, quién te atendió o qué te encantó de tu visita...' : tipo === 'sugerencia' ? '¿Qué producto te gustaría que trajéramos o qué podemos mejorar en el local?' : 'Detalla lo ocurrido para poder investigar y entregarte una solución a la brevedad...'}
            className={`w-full flex-1 min-h-[100px] bg-slate-50 border rounded-xl p-3 text-xs focus:outline-none focus:ring-2 text-slate-800 resize-none ${errors.comentario ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200 focus:ring-emerald-500'}`}
          ></textarea>
          {errors.comentario && <p className="text-[10px] text-rose-500 mt-1 font-semibold">{errors.comentario}</p>}
        </div>
        {tipo !== 'reclamo' ? (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={anonimo} onChange={(e) => setAnonimo(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" />
              <div className="text-left">
                <span className="text-xs font-bold text-slate-800">Quiero que mi envío sea Anónimo</span>
                <p className="text-[9px] text-slate-400">Si desmarcas esta opción, tus datos de contacto serán obligatorios para poder responderte.</p>
              </div>
            </label>
          </div>
        ) : (
          <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 text-left">
            <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-rose-600" />Identificación Obligatoria</p>
            <p className="text-[9px] text-rose-700/80 mt-0.5">Por motivos de seguridad y correcto seguimiento del local, los reclamos no pueden realizarse de forma anónima.</p>
          </div>
        )}
        {showContactFields && (
          <div className="space-y-2.5 border-t border-slate-100 pt-3 text-left">
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Tus datos de contacto</h4>
              <span className="text-[9px] text-rose-500 font-semibold bg-rose-50 px-2 py-0.5 rounded-full">Obligatorios *</span>
            </div>
            <div>
              <input type="text" placeholder="Nombre Completo *" value={nombre} onChange={(e) => setNombre(e.target.value)} className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 text-slate-800 ${errors.nombre ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200 focus:ring-emerald-500'}`} />
              {errors.nombre && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.nombre}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <input type="text" placeholder="WhatsApp * (ej: 56912345678)" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 text-slate-800 ${errors.telefono ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200 focus:ring-emerald-500'}`} />
                {errors.telefono && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.telefono}</p>}
              </div>
              <div>
                <input type="email" placeholder="Correo electrónico *" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 text-slate-800 ${errors.email ? 'border-rose-400 focus:ring-rose-500' : 'border-slate-200 focus:ring-emerald-500'}`} />
                {errors.email && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.email}</p>}
              </div>
            </div>
          </div>
        )}
        {tipo === 'reclamo' && (
          <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2.5 text-[11px] text-rose-800 leading-relaxed font-medium text-left">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold text-rose-950 uppercase tracking-wider block text-[10px] mb-0.5">⚠️ ADVERTENCIA DE ENVÍO</span>
              Por favor verifique que sus datos de contacto sean correctos antes de enviar su formulario para asegurar el seguimiento adecuado.
            </div>
          </div>
        )}
        <button type="submit" className="w-full font-extrabold text-white py-3 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98]">
          <Send className="w-3.5 h-3.5" /><span>Enviar Comentario</span>
        </button>
      </form>
    </div>
  );
}

// ==========================================================================
// PANEL ADMINISTRATIVO
// ==========================================================================

function AdminPanel({ tickets, onResetClean, onRestoreDefaults, setConfirmModal, onUpdateStatus, onAddNote, onDeleteTicket, googleSheetsUrl, setGoogleSheetsUrl, appsScriptUrl, setAppsScriptUrl, dbConnected }) {
  const [pinInput, setPinInput] = useState('');
  const [isLocked, setIsLocked] = useState(true);
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState('tickets');
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [posterText, setPosterText] = useState("¡Queremos escucharte! Escanea este código QR para enviarnos tus felicitaciones, sugerencias o reclamos.");
  const [posterUrl, setPosterUrl] = useState(() => {
    if (typeof window !== 'undefined' && window.location.href.startsWith('http')) {
      return window.location.href.replace('/admin', '/cliente');
    }
    return 'https://sugerencias-reclamos.vercel.app/cliente';
  });

  const selectedTicket = useMemo(() => {
    if (!selectedTicketId || !Array.isArray(tickets)) return null;
    return tickets.find(t => t.id === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  const currentNotes = useMemo(() => {
    if (!selectedTicket) return [];
    return Array.isArray(selectedTicket.notasInternas) ? selectedTicket.notasInternas : [];
  }, [selectedTicket]);

  const filteredTickets = useMemo(() => {
    if (!Array.isArray(tickets)) return [];
    return tickets.filter(ticket => {
      const s = search.toLowerCase();
      const matchSearch = (ticket.comentario || '').toLowerCase().includes(s) || (ticket.nombre || '').toLowerCase().includes(s) || (ticket.productoRelacionado || '').toLowerCase().includes(s);
      return matchSearch && (filterTipo === 'todos' || ticket.tipo === filterTipo) && (filterEstado === 'todos' || ticket.estado === filterEstado);
    });
  }, [tickets, search, filterTipo, filterEstado]);

  const stats = useMemo(() => {
    if (!Array.isArray(tickets)) return { total: 0, felicitaciones: 0, sugerencias: 0, reclamos: 0, pendientes: 0, resueltos: 0 };
    return {
      total: tickets.length,
      felicitaciones: tickets.filter(t => t.tipo === 'felicitacion').length,
      sugerencias: tickets.filter(t => t.tipo === 'sugerencia').length,
      reclamos: tickets.filter(t => t.tipo === 'reclamo').length,
      pendientes: tickets.filter(t => t.estado === 'pendiente').length,
      resueltos: tickets.filter(t => t.estado === 'resuelto').length,
    };
  }, [tickets]);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === '1234') { setIsLocked(false); setPinError(false); }
    else { setPinError(true); setPinInput(''); }
  };

  const handleAddNoteSubmit = (e) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedTicketId) return;
    onAddNote(selectedTicketId, newNote.trim());
    setNewNote('');
  };

  const handleSendWhatsApp = (ticket) => {
    if (!ticket?.telefono) return;
    const nombre = ticket.nombre || 'Cliente';
    const corto = (ticket.comentario || '').substring(0, 60);
    let text = ticket.tipo === 'felicitacion'
      ? `¡Hola ${nombre}! Te saludamos de Punto Verde Organic 🌿. Queríamos agradecerte tu maravillosa felicitación sobre: "${corto}...". ¡Que tengas un excelente día!`
      : ticket.tipo === 'sugerencia'
      ? `¡Hola ${nombre}! Gracias por escribirnos a Punto Verde Organic 🌿. Recibimos tu sugerencia sobre "${ticket.categoria}". La ingresamos a nuestra planificación mensual. ¡Agradecemos tu aporte!`
      : `¡Hola ${nombre}! Te escribimos de Punto Verde Organic 🌿. Lamentamos el inconveniente reportado respecto a "${ticket.categoria}". Nos gustaría ofrecerte una solución. ¿En qué horario te llamamos?`;
    const phone = String(ticket.telefono).trim();
    window.open(`https://api.whatsapp.com/send?phone=${phone.startsWith('56') ? phone : '56' + phone}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const ticketIdShort = useMemo(() => {
    if (!selectedTicket?.id) return '';
    const parts = String(selectedTicket.id).split('-');
    return (parts.length > 1 ? parts[1] : parts[0]).substring(0, 5);
  }, [selectedTicket]);

  if (isLocked) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 max-w-md mx-auto text-center">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
          <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-full inline-block mb-4"><Lock className="w-8 h-8" /></div>
          <h2 className="text-xl font-extrabold text-white">Panel Administrativo</h2>
          <p className="text-xs text-slate-400 mt-1 mb-6">Ingresa el código PIN para acceder a la gestión y estadísticas de la tienda.</p>
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <input type="password" placeholder="Ingresa PIN (Por defecto: 1234)" value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                className={`w-full bg-slate-950 border text-center text-lg font-bold tracking-widest rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white ${pinError ? 'border-rose-500' : 'border-slate-800'}`} />
              {pinError && <p className="text-xs text-rose-500 mt-1.5 font-semibold">PIN incorrecto. Intenta con 1234.</p>}
            </div>
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold py-3 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" /><span>Acceder al Panel</span>
            </button>
          </form>
          <div className="mt-6 border-t border-slate-800 pt-4 flex justify-between text-[10px] text-slate-500">
            <span>Punto Verde Organic © 2026</span><span>PIN de Test: 1234</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div className="text-left">
          <h2 className="text-xl font-black text-white flex items-center gap-2">🌿 Panel de Gestión de Tickets</h2>
          <p className="text-xs text-slate-400 mt-0.5">Control centralizado de sugerencias, felicitaciones y reclamos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dbConnected
            ? <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-3 py-1 rounded-full animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>⚡ Nube Conectada</div>
            : <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1 rounded-full">💾 Local / Desconectado</div>
          }
          <div className="flex items-center gap-1">
            {['tickets', 'stats', 'poster'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeTab === tab ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:text-white'}`}>
                {tab === 'poster' && <QrCode className="w-3.5 h-3.5" />}
                {tab === 'tickets' ? 'Comentarios' : tab === 'stats' ? 'Estadísticas' : 'Cartel QR'}
              </button>
            ))}
            <button onClick={() => setIsLocked(true)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 ml-2" title="Cerrar Sesión"><Lock className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-left">
        {[
          { label: 'Total', value: stats.total, icon: <MessageSquare className="w-4 h-4" />, color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Felicitaciones', value: stats.felicitaciones, icon: <Heart className="w-4 h-4 fill-emerald-500/20" />, color: 'bg-emerald-500/10 text-emerald-400' },
          { label: 'Sugerencias', value: stats.sugerencias, icon: <Lightbulb className="w-4 h-4" />, color: 'bg-amber-500/10 text-amber-400' },
          { label: 'Reclamos', value: stats.reclamos, icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-rose-500/10 text-rose-400' },
          { label: 'Pendientes', value: stats.pendientes, icon: <Clock className="w-4 h-4" />, color: 'bg-yellow-500/10 text-yellow-400' },
          { label: 'Resueltos', value: stats.resueltos, icon: <CheckCircle className="w-4 h-4" />, color: 'bg-emerald-50/25 text-emerald-300' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-slate-900/50 border border-slate-800 p-3 rounded-2xl flex items-center gap-3">
            <div className={`${color} p-2 rounded-xl`}>{icon}</div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">{label}</span>
              <span className="text-lg font-black text-white">{value}</span>
            </div>
          </div>
        ))}
      </div>

      {activeTab === 'tickets' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className={`${selectedTicket ? 'xl:col-span-7' : 'xl:col-span-12'} flex flex-col gap-4`}>
            <div className="bg-slate-900/70 p-3 border border-slate-800 rounded-2xl flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="text" placeholder="Buscar por cliente, comentario, producto..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-white" />
              </div>
              <div className="flex gap-2">
                <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-300 font-semibold cursor-pointer">
                  <option value="todos">Todos los tipos</option>
                  <option value="felicitacion">💚 Felicitaciones</option>
                  <option value="sugerencia">💡 Sugerencias</option>
                  <option value="reclamo">⚠️ Reclamos</option>
                </select>
                <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-300 font-semibold cursor-pointer">
                  <option value="todos">Todos los estados</option>
                  <option value="pendiente">🟡 Pendiente</option>
                  <option value="en-revision">🔵 En Revisión</option>
                  <option value="resuelto">🟢 Resuelto</option>
                </select>
              </div>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scroll">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
                  <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-semibold">No se encontraron comentarios.</p>
                  <p className="text-slate-500 text-xs mt-1">Intenta ajustando los filtros de búsqueda.</p>
                </div>
              ) : filteredTickets.map(ticket => {
                const isSelected = selectedTicketId === ticket.id;
                let formattedDate = 'Fecha N/A';
                try { if (ticket.fecha) formattedDate = new Date(ticket.fecha).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
                const notasCount = Array.isArray(ticket.notasInternas) ? ticket.notasInternas.length : 0;
                return (
                  <div key={ticket.id} onClick={() => setSelectedTicketId(ticket.id)} className={`p-4 rounded-2xl border transition-all cursor-pointer text-left ${isSelected ? 'bg-slate-800/80 border-emerald-500/80 ring-1 ring-emerald-500/50 shadow-md' : 'bg-slate-900 hover:bg-slate-800 border-slate-800'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1 ${ticket.tipo === 'felicitacion' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/50' : ticket.tipo === 'sugerencia' ? 'bg-amber-950 text-amber-400 border border-amber-900/50' : 'bg-rose-950 text-rose-400 border border-rose-900/50'}`}>
                          {ticket.tipo === 'felicitacion' && <Heart className="w-2.5 h-2.5" />}
                          {ticket.tipo === 'sugerencia' && <Lightbulb className="w-2.5 h-2.5" />}
                          {ticket.tipo === 'reclamo' && <AlertTriangle className="w-2.5 h-2.5" />}
                          {ticket.tipo}
                        </span>
                        <span className="text-[10px] text-slate-500 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-full">{ticket.categoria}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />{formattedDate}</span>
                        <span className={`w-2.5 h-2.5 rounded-full ${ticket.estado === 'pendiente' ? 'bg-yellow-500' : ticket.estado === 'en-revision' ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-200 mt-2.5 line-clamp-2 leading-relaxed">{ticket.comentario}</p>
                    <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-1 text-slate-400">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        {ticket.anonimo ? <span className="text-slate-500 italic">Anónimo</span> : <span className="text-slate-300">{ticket.nombre}</span>}
                      </div>
                      {notasCount > 0 && <span className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded">{notasCount} nota(s)</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedTicket && (
            <div className="xl:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col gap-4 sticky top-24 max-h-[calc(100vh-140px)] overflow-y-auto custom-scroll text-left shadow-2xl">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Detalle del Ticket</h3>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">ID: #{ticketIdShort}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">Gestión y seguimiento de este caso.</p>
                </div>
                <button onClick={() => setSelectedTicketId(null)} className="text-slate-500 hover:text-white bg-slate-950 p-1.5 rounded-lg hover:bg-slate-800 transition-all"><X className="w-4 h-4" /></button>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 text-xs space-y-2.5 leading-relaxed">
                <div className="flex justify-between font-bold text-slate-300">
                  <span>Tipo:</span>
                  <span className={`uppercase font-black ${selectedTicket.tipo === 'felicitacion' ? 'text-emerald-400' : selectedTicket.tipo === 'sugerencia' ? 'text-amber-400' : 'text-rose-400'}`}>{selectedTicket.tipo}</span>
                </div>
                <div className="flex justify-between text-slate-400"><span>Categoría:</span><span className="text-slate-200 font-semibold">{selectedTicket.categoria}</span></div>
                {selectedTicket.productoRelacionado && <div className="flex justify-between text-slate-400"><span>Producto:</span><span className="text-emerald-400 font-semibold">{selectedTicket.productoRelacionado}</span></div>}
                <div className="bg-slate-900/60 p-3 rounded-xl italic text-slate-300 border border-slate-800 mt-2">"{selectedTicket.comentario}"</div>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 text-xs">
                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Información de Contacto</h4>
                {selectedTicket.anonimo ? <div className="text-slate-500 italic py-1">Enviado de forma completamente anónima.</div> : (
                  <div className="space-y-2 text-slate-300 font-medium">
                    <div className="flex items-center gap-2"><span className="text-slate-500 w-14">Nombre:</span><span className="text-white font-bold">{selectedTicket.nombre}</span></div>
                    {selectedTicket.telefono && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2"><span className="text-slate-500 w-14">Celular:</span><span className="font-mono text-emerald-400">+{selectedTicket.telefono}</span></div>
                        <button onClick={() => handleSendWhatsApp(selectedTicket)} className="bg-emerald-600/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 px-2.5 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1 transition-all border border-emerald-900/30">Responder WSP <ExternalLink className="w-2.5 h-2.5" /></button>
                      </div>
                    )}
                    {selectedTicket.email && <div className="flex items-center gap-2 pt-1"><span className="text-slate-500 w-14">Email:</span><span className="font-mono text-slate-300 break-all">{selectedTicket.email}</span></div>}
                  </div>
                )}
              </div>
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cambiar Estado</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['pendiente', 'en-revision', 'resuelto'].map(estado => (
                    <button key={estado} onClick={() => onUpdateStatus(selectedTicket.id, estado)} className={`py-1.5 rounded-xl text-[10px] font-bold transition-all border ${selectedTicket.estado === estado ? (estado === 'pendiente' ? 'bg-yellow-500 text-slate-950 border-yellow-400' : estado === 'en-revision' ? 'bg-blue-500 text-white border-blue-400' : 'bg-emerald-500 text-slate-950 border-emerald-400') : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'}`}>
                      {estado === 'en-revision' ? 'En Revisión' : estado.charAt(0).toUpperCase() + estado.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-950/60 border border-emerald-500/20 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" />Seguimiento Interno</h4>
                  <span className="text-[9px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">Solo uso administrativo</span>
                </div>
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 custom-scroll text-[11px]">
                  {currentNotes.length === 0 ? <div className="text-slate-600 italic py-3 text-center">Sin anotaciones aún.</div> : currentNotes.map((note, i) => (
                    <div key={i} className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 text-slate-300 flex items-start gap-2.5 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" /><span className="flex-1">{note}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddNoteSubmit} className="flex gap-2 pt-1">
                  <input type="text" placeholder="Escribe una nota de seguimiento..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-500" />
                  <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 px-3 rounded-xl flex items-center justify-center font-bold transition-all shrink-0"><Plus className="w-4 h-4" /></button>
                </form>
              </div>
              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button onClick={() => onDeleteTicket(selectedTicket.id)} className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 rounded-xl text-[10px] flex items-center gap-1 transition-all font-bold"><Trash2 className="w-3.5 h-3.5" />Eliminar Ticket</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="space-y-6 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Configuración Google Sheets</h3>
                    <p className="text-[10px] text-slate-400">Sincroniza y visualiza datos en tiempo real</p>
                  </div>
                  {appsScriptUrl ? <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/45 border border-emerald-900/40 px-2 py-0.5 rounded-full">SINC ACTIVADA</span> : <span className="text-[9px] font-black text-slate-500 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-full">MODO LOCAL</span>}
                </div>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">1. Enlace de la Planilla Google Sheets:</label>
                    <div className="relative flex items-center">
                      <input type="text" value={googleSheetsUrl} onChange={(e) => setGoogleSheetsUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-12 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                      <button onClick={() => googleSheetsUrl && window.open(googleSheetsUrl, '_blank')} className="absolute right-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 p-1.5 rounded-lg transition-all"><ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" /></button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">2. Enlace de Google Apps Script (Webhook):</label>
                    <input type="text" value={appsScriptUrl} onChange={(e) => setAppsScriptUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-xs text-slate-300 flex flex-col justify-between">
              <div>
                <h4 className="font-extrabold text-emerald-400 uppercase tracking-wider text-[10px] mb-2">💡 ¿Cómo conseguir tu URL de Apps Script?</h4>
                <ol className="list-decimal pl-4 space-y-2 text-slate-400 leading-relaxed mt-2">
                  <li>Abre tu planilla y ve a <span className="text-white font-bold">Extensiones → Apps Script</span>.</li>
                  <li>Pega el código y haz clic en <span className="text-white font-bold">Implementar → Nueva implementación</span>.</li>
                  <li>Configura tipo <span className="text-white font-bold">Aplicación Web</span> con acceso para "Cualquiera" y pega el enlace generado aquí.</li>
                </ol>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" />Rendimiento y Satisfacción</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 mb-1">Proporción por tipo de comentario</h4>
                <p className="text-[10px] text-slate-500 mb-4">Qué predomina en el local.</p>
                {stats.total === 0 ? <p className="text-xs text-slate-500 text-center py-6 italic">Sin datos suficientes.</p> : (
                  <div className="space-y-3">
                    {[{ label: 'Felicitaciones 💚', value: stats.felicitaciones, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
                      { label: 'Sugerencias 💡', value: stats.sugerencias, color: 'bg-amber-500', textColor: 'text-amber-400' },
                      { label: 'Reclamos ⚠️', value: stats.reclamos, color: 'bg-rose-500', textColor: 'text-rose-400' }].map(({ label, value, color, textColor }) => (
                      <div key={label}>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className={`${textColor} font-bold`}>{label}</span>
                          <span className="text-slate-400 font-mono">{Math.round((value / stats.total) * 100)}% ({value})</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2"><div className={`${color} h-2 rounded-full`} style={{ width: `${(value / stats.total) * 100}%` }}></div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 mb-1">Tasa de respuesta y resolución</h4>
                <p className="text-[10px] text-slate-500 mb-4">Eficacia del equipo para resolver tickets.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900 p-3 rounded-lg text-center border border-slate-800">
                    <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wide">Tasa Resolución</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono">{stats.total === 0 ? '0%' : `${Math.round((stats.resueltos / stats.total) * 100)}%`}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg text-center border border-slate-800">
                    <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wide">Con WhatsApp</span>
                    <span className="text-2xl font-black text-blue-400 font-mono">{tickets.filter(t => !t.anonimo && t.telefono).length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-300">Mantenimiento de Datos</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Controla la persistencia de datos o simula cargas de testeo.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onRestoreDefaults} className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all"><RefreshCw className="w-3.5 h-3.5" />Cargar Ejemplos</button>
              <button onClick={onResetClean} className="bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 border border-rose-900/30 rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all"><Trash2 className="w-3.5 h-3.5" />Limpiar BD</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'poster' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2"><Printer className="w-4 h-4 text-emerald-500" />Generador de Cartelería QR</h3>
              <p className="text-xs text-slate-400 mt-0.5">Imprime este cartel y colócalo en el mostrador para que tus clientes opinen.</p>
            </div>
            <button onClick={() => window.print()} className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold py-1.5 px-3.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"><Printer className="w-4 h-4" />Imprimir / Guardar PDF</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4 text-xs text-left">
              <h4 className="font-extrabold text-slate-300 uppercase tracking-wider text-[10px] border-b border-slate-800 pb-2">Personalizar Cartel</h4>
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">Mensaje de llamado a la acción:</label>
                <textarea value={posterText} onChange={(e) => setPosterText(e.target.value)} rows={3} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-300"></textarea>
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">URL para el QR (vista cliente):</label>
                <input type="text" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-emerald-400 font-mono" />
                <p className="text-[10px] text-slate-500 mt-1">Por defecto apunta a <span className="text-emerald-400">/cliente</span> para que los clientes solo vean el formulario.</p>
              </div>
              <div className="bg-emerald-950/20 p-3 rounded-lg border border-emerald-900/30 text-emerald-300">
                <p className="font-bold mb-0.5">💡 Tip de Impresión</p>
                <p className="text-[10px] text-slate-400 leading-relaxed">Usa papel opalina o cartulina gruesa. El tamaño ideal es A5 o medio pliego de carta.</p>
              </div>
            </div>
            <div className="lg:col-span-8 flex justify-center py-2 bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
              <div className="w-[380px] bg-white text-slate-900 p-8 rounded-2xl border border-slate-200 shadow-2xl flex flex-col items-center justify-between text-center aspect-[1/1.41] relative">
                <div className="absolute inset-4 border-2 border-emerald-500 rounded-xl pointer-events-none"></div>
                <div className="absolute top-4 left-4 right-4 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-t-lg"></div>
                <div className="pt-6">
                  <div className="inline-flex items-center justify-center bg-emerald-50 border border-emerald-100 w-14 h-14 rounded-full mb-3"><span className="text-3xl">🌿</span></div>
                  <h3 className="text-xl font-black text-emerald-800 tracking-tight">Punto Verde Organic</h3>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-0.5">Tienda Saludable & Botica Natural</p>
                </div>
                <div className="my-4 flex flex-col items-center gap-2">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl shadow-inner">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(posterUrl)}`} alt="Código QR" className="w-40 h-40 object-contain" />
                  </div>
                  <span className="text-[11px] font-black tracking-wider text-emerald-700 uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 mt-2">ESCANEA EL CÓDIGO QR</span>
                </div>
                <div className="px-6 pb-6">
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">{posterText}</p>
                  <p className="text-[9px] text-slate-400 mt-3 font-semibold">Tu opinión va directo a nuestro equipo administrativo para brindarte un servicio excelente.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

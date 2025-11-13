// =====================================================================
// MÓDULO 0: IMPORTACIONES Y CONFIGURACIÓN DE FIREBASE (v9+)
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    setDoc,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    collectionGroup // Necesario para la subcolección
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// FUNDAMENTO: Configuración de Firebase (Proyecto: la-sazon-de-gloria-prod)
const firebaseConfig = {
    apiKey: "AIzaSyBDvJBxcUAgVBW56IZvyuo3hjxbwEqRwJ8",
    authDomain: "la-sazon-de-gloria-prod.firebaseapp.com",
    projectId: "la-sazon-de-gloria-prod",
    storageBucket: "la-sazon-de-gloria-prod.firebasestorage.app",
    messagingSenderId: "314611616927",
    appId: "1:314611616927:web:e6a494773fcbfac63b26aa",
    measurementId: "G-KZFQRSL335"
};

// Inicializar Firebase
const app_firebase = initializeApp(firebaseConfig);
const auth = getAuth(app_firebase);
const db = getFirestore(app_firebase);

// Referencias a Colecciones (Estándar de Excelencia v9+)
const categoriesCol = collection(db, 'categories');
const ordersCol = collection(db, 'orders');
const usersCol = collection(db, 'users');

// =====================================================================
// CONSTANTES Y ESTADO DE LA APLICACIÓN
// =====================================================================

const state = {
    currentPage: 'home',
    menuData: [], // Almacenará productos y categorías de Firestore
    cart: [], // { id, name, price, quantity, image }
    currentUser: null, // { uid, email, name, phone, address }
    deliveryCost: 4000 // Costo de domicilio
};

// =====================================================================
// MÓDULO PRINCIPAL DE LA APP (Controlador)
// =====================================================================
// Hacemos 'app' global para que los `onclick` del HTML funcionen
window.app = {

    /**
     * Inicializa la aplicación
     */
    init() {
        console.log('Iniciando La Sazón de Gloria PWA v1.3 (Firebase v9+)...');

        this.loadCartFromStorage();
        this.setupEventListeners();

        // Listener de autenticación (CRÍTICO)
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log('Auth: Usuario logueado', user.uid);
                const userInfo = await this.auth.getUserProfile(user.uid);
                state.currentUser = {
                    uid: user.uid,
                    email: user.email,
                    ...(userInfo || {}) // Usar perfil de DB o vacío
                };
                this.ui.updateLoginState(true, state.currentUser.name || state.currentUser.email);
            } else {
                console.log('Auth: Usuario deslogueado.');
                state.currentUser = null;
                this.ui.updateLoginState(false);
            }
            // Navegar a la página de inicio (o la vista actual) después de verificar auth
            this.navigateTo(state.currentPage || 'home');
        });

        this.registerServiceWorker();
    },

    /**
     * Configura todos los event listeners de la UI
     */
    setupEventListeners() {
        // Event Listeners globales que no se pueden manejar por 'onclick'
        document.getElementById('mobile-menu-button').addEventListener('click', () => {
            document.getElementById('mobile-menu').classList.toggle('hidden');
        });

        document.getElementById('login-tab-btn').addEventListener('click', () => this.ui.toggleLoginTabs(true));
        document.getElementById('register-tab-btn').addEventListener('click', () => this.ui.toggleLoginTabs(false));

        document.getElementById('login-form').addEventListener('submit', this.auth.handleLogin);
        document.getElementById('register-form').addEventListener('submit', this.auth.handleRegister);

        document.getElementById('checkout-form').addEventListener('submit', this.checkout.handleCheckout);

        // Delegación de eventos para elementos dinámicos
        document.getElementById('menu-container').addEventListener('click', (e) => {
            if (e.target.closest('.add-to-cart-btn')) {
                const productCard = e.target.closest('.bg-white');
                const productId = productCard.dataset.productId;
                this.cart.add(productId);
            }
        });

        document.getElementById('cart-items-list').addEventListener('click', (e) => {
            const cartItem = e.target.closest('.grid');
            if (!cartItem) return;
            const productId = cartItem.dataset.productId;
            if (e.target.closest('.remove-item-btn')) {
                this.cart.remove(productId);
            }
        });

        document.getElementById('cart-items-list').addEventListener('change', (e) => {
            const cartItem = e.target.closest('.grid');
            if (!cartItem || !e.target.classList.contains('quantity-input')) return;
            const productId = cartItem.dataset.productId;
            const newQuantity = parseInt(e.target.value, 10);
            if (newQuantity > 0) {
                this.cart.updateQuantity(productId, newQuantity);
            } else {
                this.cart.remove(productId);
            }
        });
    },

    /**
     * Maneja la navegación entre las "páginas" (vistas) de la SPA
     */
    navigateTo(pageId) {
        console.log(`Navegando a: ${pageId}`);

        document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));

        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) {
            targetPage.classList.remove('hidden');
            state.currentPage = pageId;
        } else {
            console.warn(`Página no encontrada: ${pageId}. Redirigiendo a home.`);
            document.getElementById('page-home').classList.remove('hidden');
            state.currentPage = 'home';
        }

        document.getElementById('mobile-menu').classList.add('hidden');
        window.scrollTo(0, 0);

        // Lógica específica por página
        switch (pageId) {
            case 'home':
                this.menu.load();
                break;
            case 'cart':
                this.cart.render();
                break;
            case 'checkout':
                this.checkout.render();
                break;
            case 'profile':
                this.profile.load();
                break;
        }
    },

    // =====================================================================
    // MÓDULO 1: AUTENTICACIÓN (Firebase Auth v9+)
    // =====================================================================
    auth: {
        async handleLogin(e) {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                app.ui.showToast('Ingresando...', 'info');
                await signInWithEmailAndPassword(auth, email, password);
                // El listener onAuthStateChanged maneja el resto
                app.hideLoginModal();
                app.ui.showToast('¡Bienvenido de nuevo!', 'success');
                app.navigateTo('profile');
            } catch (error) {
                console.error('Error de login:', error);
                app.ui.showToast(app.auth.translateError(error.code), 'error');
            }
        },

        async handleRegister(e) {
            e.preventDefault();
            const name = document.getElementById('register-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;

            if (password.length < 6) {
                app.ui.showToast('La contraseña debe tener al menos 6 caracteres', 'error');
                return;
            }

            try {
                app.ui.showToast('Creando cuenta...', 'info');
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Crear perfil de usuario en Firestore (v9+)
                const userDocRef = doc(usersCol, user.uid);
                await setDoc(userDocRef, {
                    name: name,
                    email: email,
                    phone: '',
                    address: ''
                });

                app.ui.showToast('¡Registro exitoso! Ahora puedes ingresar.', 'success');
                app.ui.toggleLoginTabs(true); // Cambiar a la pestaña de login
            } catch (error) {
                console.error('Error de registro:', error);
                app.ui.showToast(app.auth.translateError(error.code), 'error');
            }
        },

        async logout() {
            await signOut(auth);
            app.navigateTo('home');
            app.ui.showToast('Has cerrado sesión', 'info');
        },

        async getUserProfile(uid) {
            try {
                const userDocRef = doc(usersCol, uid);
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists()) {
                    return docSnap.data();
                } else {
                    console.warn(`No se encontró perfil para el UID: ${uid}`);
                    return null;
                }
            } catch (error) {
                console.error("Error obteniendo perfil de usuario:", error);
                return null;
            }
        },

        translateError(code) {
            switch (code) {
                case 'auth/wrong-password':
                    return 'Contraseña incorrecta.';
                case 'auth/user-not-found':
                    return 'Usuario no encontrado.';
                case 'auth/invalid-email':
                    return 'Email inválido.';
                case 'auth/email-already-in-use':
                    return 'El email ya está en uso.';
                default:
                    return 'Error de autenticación. Intenta de nuevo.';
            }
        }
    },

    // =====================================================================
    // MÓDULO 2: MENÚ (Firestore v9+)
    // =====================================================================
    menu: {
        async load() {
            if (state.menuData.length > 0) {
                console.log('Menú ya cargado, usando cache de estado.');
                this.render(state.menuData);
                return;
            }

            console.log('Cargando menú desde Firestore v9+...');
            const loadingSpinner = document.getElementById('loading-spinner');
            loadingSpinner.classList.remove('hidden');

            try {
                // Lee la estructura de FASE 1 (Paso 1.5)
                const q = query(categoriesCol, orderBy('order', 'asc'));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    console.warn('No se encontraron categorías en Firestore.');
                    loadingSpinner.innerHTML = '<p class="text-brand-gray">No hay productos disponibles en este momento.</p>';
                    return;
                }

                // Mapeo asíncrono para obtener subcolecciones
                const categories = await Promise.all(snapshot.docs.map(async (categoryDoc) => {
                    const category = { id: categoryDoc.id, ...categoryDoc.data() };

                    // Cargar la subcolección de productos (v9+)
                    const productsCol = collection(db, 'categories', categoryDoc.id, 'products');
                    const productsSnapshot = await getDocs(productsCol);

                    category.products = productsSnapshot.docs.map(productDoc => ({
                        id: productDoc.id,
                        ...productDoc.data()
                    }));

                    return category;
                }));

                state.menuData = categories;
                this.render(state.menuData);

            } catch (error) {
                console.error('Error cargando menú desde Firestore:', error);
                app.ui.showToast('Error al cargar el menú', 'error');
                loadingSpinner.innerHTML = '<p class="text-red-500">Error al cargar el menú. Intenta de nuevo.</p>';
            }
        },

        render(categories) {
            const container = document.getElementById('menu-container');
            const categoryTemplate = document.getElementById('category-template');

            container.innerHTML = ''; // Limpiar (elimina el spinner)

            categories.forEach(category => {
                const categoryClone = categoryTemplate.cloneNode(true);
                categoryClone.id = `category-${category.id}`;
                categoryClone.classList.remove('hidden');
                categoryClone.querySelector('h3').textContent = category.name;

                const productGrid = categoryClone.querySelector('.product-grid');
                productGrid.innerHTML = ''; // Limpiar la plantilla de producto

                if (category.products && category.products.length > 0) {
                    category.products.forEach(product => {
                        // FUNDAMENTO: Esta línea fallaba porque 'product-template' era null (Error en index.html)
                        const productTemplate = document.getElementById('product-template');
                        const productClone = productTemplate.cloneNode(true);
                        productClone.id = `product-${product.id}`;
                        productClone.dataset.productId = product.id; // ID para el botón de agregar

                        productClone.querySelector('img').src = product.image || `https://placehold.co/600x400/${tailwind.config.theme.extend.colors['brand-primary'].substring(1)}/3E2723?text=${encodeURIComponent(product.name)}`;
                        productClone.querySelector('img').alt = product.name;
                        productClone.querySelector('h4').textContent = product.name;
                        productClone.querySelector('p').textContent = product.description;
                        productClone.querySelector('.text-2xl').textContent = app.ui.formatCurrency(product.price);
                        productClone.querySelector('.add-to-cart-btn').dataset.productId = product.id;

                        productGrid.appendChild(productClone);
                    });
                } else {
                    productGrid.innerHTML = '<p class="text-brand-gray">No hay productos en esta categoría.</p>';
                }

                container.appendChild(categoryClone);
            });
        },

        findProductById(productId) {
            for (const category of state.menuData) {
                if (category.products) {
                    const product = category.products.find(p => p.id === productId);
                    if (product) return product;
                }
            }
            console.warn(`Producto no encontrado en el estado: ${productId}`);
            return null;
        }
    },

    // =====================================================================
    // MÓDULO 3: CARRITO (localStorage)
    // =====================================================================
    cart: {
        add(productId) {
            const product = app.menu.findProductById(productId);
            if (!product) {
                app.ui.showToast('Error al añadir producto', 'error');
                return;
            }

            const existingItem = state.cart.find(item => item.id === productId);

            if (existingItem) {
                existingItem.quantity++;
            } else {
                state.cart.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image,
                    quantity: 1
                });
            }

            app.ui.showToast(`'${product.name}' agregado al carrito`, 'success');
            this.save();
            this.updateUICounters();
        },

        remove(productId) {
            state.cart = state.cart.filter(item => item.id !== productId);
            app.ui.showToast('Producto quitado del carrito', 'info');
            this.save();
            this.render();
        },

        updateQuantity(productId, quantity) {
            const item = state.cart.find(item => item.id === productId);
            if (item) {
                item.quantity = quantity;
                this.save();
                this.render();
            }
        },

        getSubtotal() {
            return state.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
        },

        getTotal() {
            if (state.cart.length === 0) return 0;
            return this.getSubtotal() + state.deliveryCost;
        },

        save() {
            localStorage.setItem('sazonCart', JSON.stringify(state.cart));
        },

        load() {
            app.loadCartFromStorage();
        },

        clear() {
            state.cart = [];
            this.save();
            this.updateUICounters();
        },

        render() {
            const container = document.getElementById('cart-items-list');
            const template = document.getElementById('cart-item-template');
            const emptyMsg = document.getElementById('cart-empty-message');
            const summary = document.getElementById('cart-summary');

            container.innerHTML = '';

            if (state.cart.length === 0) {
                emptyMsg.classList.remove('hidden');
                summary.classList.add('hidden');
            } else {
                emptyMsg.classList.add('hidden');
                summary.classList.remove('hidden');

                state.cart.forEach(item => {
                    const clone = template.cloneNode(true);
                    clone.id = `cart-item-${item.id}`;
                    clone.dataset.productId = item.id;
                    clone.classList.remove('hidden');

                    clone.querySelector('img').src = item.image || 'https://placehold.co/100x100/EA906C/white?text=Plato';
                    clone.querySelector('h4').textContent = item.name;
                    clone.querySelector('span[class*="text-brand-gray"]').textContent = app.ui.formatCurrency(item.price);
                    clone.querySelector('.quantity-input').value = item.quantity;
                    clone.querySelector('span[class*="text-brand-dark"]').textContent = app.ui.formatCurrency(item.price * item.quantity);

                    container.appendChild(clone);
                });
            }

            this.updateUICounters();
            this.updateTotals();
        },

        updateUICounters() {
            const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
            document.getElementById('cart-count-desktop').textContent = totalItems;
            document.getElementById('cart-count-mobile').textContent = totalItems;
            document.getElementById('cart-count-desktop').classList.toggle('hidden', totalItems === 0);
            document.getElementById('cart-count-mobile').classList.toggle('hidden', totalItems === 0);
        },

        updateTotals() {
            const subtotal = this.getSubtotal();
            const total = this.getTotal();
            document.getElementById('summary-subtotal').textContent = app.ui.formatCurrency(subtotal);
            document.getElementById('summary-delivery').textContent = app.ui.formatCurrency(state.deliveryCost);
            document.getElementById('summary-total').textContent = app.ui.formatCurrency(total);
        }
    },

    // =====================================================================
    // MÓDULO 4: CHECKOUT (Firestore v9+)
    // =====================================================================
    checkout: {
        render() {
            if (state.cart.length === 0) {
                app.ui.showToast('Tu carrito está vacío', 'warning');
                app.navigateTo('home');
                return;
            }

            if (state.currentUser) {
                document.getElementById('checkout-name').value = state.currentUser.name || '';
                document.getElementById('checkout-phone').value = state.currentUser.phone || '';
                document.getElementById('checkout-address').value = state.currentUser.address || '';
            }

            const container = document.getElementById('checkout-summary-items');
            container.innerHTML = '';
            state.cart.forEach(item => {
                container.innerHTML += `
                    <div class="flex justify-between text-brand-gray">
                        <span>${item.quantity}x ${item.name}</span>
                        <span class="font-medium text-brand-dark">${app.ui.formatCurrency(item.price * item.quantity)}</span>
                    </div>
                `;
            });

            const subtotal = app.cart.getSubtotal();
            const total = app.cart.getTotal();
            document.getElementById('checkout-subtotal').textContent = app.ui.formatCurrency(subtotal);
            document.getElementById('checkout-delivery').textContent = app.ui.formatCurrency(state.deliveryCost);
            document.getElementById('checkout-total').textContent = app.ui.formatCurrency(total);
        },

        async handleCheckout(e) {
            e.preventDefault();

            if (!document.getElementById('privacy-policy-checkbox').checked) {
                app.ui.showToast('Debe aceptar la Política de Tratamiento de Datos', 'error');
                return;
            }
            if (!document.getElementById('terms-conditions-checkbox').checked) {
                app.ui.showToast('Debe aceptar los Términos y Condiciones', 'error');
                return;
            }

            app.ui.showToast('Procesando pedido...', 'info');

            const orderData = {
                customer: {
                    name: document.getElementById('checkout-name').value,
                    phone: document.getElementById('checkout-phone').value,
                    address: document.getElementById('checkout-address').value,
                    notes: document.getElementById('checkout-notes').value,
                    email: state.currentUser ? state.currentUser.email : 'anonimo@anonimo.com'
                },
                items: state.cart,
                total: app.cart.getTotal(),
                subtotal: app.cart.getSubtotal(),
                deliveryCost: state.deliveryCost,
                status: "RECIBIDO",
                createdAt: serverTimestamp(), // Función v9+
                userId: state.currentUser ? state.currentUser.uid : 'anonimo'
            };

            try {
                // Enviar el pedido a Firestore (v9+)
                const docRef = await addDoc(ordersCol, orderData);
                console.log("Pedido creado en Firestore con ID:", docRef.id);

                // (Futuro) Integrar Pasarela de Pagos

                app.cart.clear();
                app.navigateTo('order-success');
                app.ui.showToast('¡Pedido recibido con éxito!', 'success');
            } catch (error) {
                console.error('Error en checkout:', error);
                app.ui.showToast('Error al procesar el pedido', 'error');
            }
        }
    },

    // =====================================================================
    // MÓDULO 5: PERFIL (Firestore v9+)
    // =====================================================================
    profile: {
        async load() {
            const loading = document.getElementById('profile-loading');
            const notLoggedIn = document.getElementById('profile-not-logged-in');
            const loggedInContainer = document.getElementById('profile-logged-in');

            loading.classList.add('hidden');
            notLoggedIn.classList.add('hidden');
            loggedInContainer.classList.add('hidden');

            if (!state.currentUser) {
                console.log('Perfil: Usuario no logueado.');
                notLoggedIn.classList.remove('hidden');
                return;
            }

            loggedInContainer.classList.remove('hidden');
            document.getElementById('user-name-placeholder').textContent = state.currentUser.name || state.currentUser.email;
            document.getElementById('user-email-placeholder').textContent = state.currentUser.email;
            loading.classList.remove('hidden');

            try {
                // FUNDAMENTO: Esta consulta REQUIERE UN ÍNDICE COMPUESTO en Firestore.
                // El error aparecerá en la consola como un enlace para crear el índice.
                const q = query(
                    ordersCol,
                    where('userId', '==', state.currentUser.uid),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(q);

                const orders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                this.render(orders);

            } catch (error) {
                console.error('Error cargando historial de pedidos:', error);
                app.ui.showToast('Error al cargar tu historial', 'error');
                loading.classList.add('hidden');
            }
        },

        render(orders) {
            const loading = document.getElementById('profile-loading');
            const ordersList = document.getElementById('profile-orders-list');
            const noOrders = document.getElementById('profile-no-orders');
            const template = document.getElementById('order-history-template');

            loading.classList.add('hidden');

            if (orders.length === 0) {
                noOrders.classList.remove('hidden');
                ordersList.innerHTML = '';
            } else {
                noOrders.classList.add('hidden');
                ordersList.innerHTML = ''; // Limpiar

                orders.forEach(order => {
                    const clone = template.cloneNode(true);
                    clone.id = `order-${order.id}`;
                    clone.classList.remove('hidden');

                    clone.querySelector('h3').textContent = `Pedido #${order.id.substring(0, 6)}...`;
                    clone.querySelector('p').textContent = order.createdAt ? new Date(order.createdAt.toDate()).toLocaleString('es-CO') : 'Fecha pendiente';

                    const statusBadge = clone.querySelector('.status-badge');
                    statusBadge.textContent = this.formatStatus(order.status);
                    statusBadge.className = `status-badge text-sm font-medium px-3 py-1 rounded-full ${this.getStatusColor(order.status)}`;

                    const itemsContainer = clone.querySelector('#order-items-container');
                    itemsContainer.innerHTML = ''; // Limpiar items de plantilla
                    order.items.forEach(item => {
                        itemsContainer.innerHTML += `
                            <div class="flex justify-between text-brand-gray">
                                <span>${item.quantity}x ${item.name}</span>
                            </div>
                        `;
                    });

                    clone.querySelector('.text-xl .text-brand-primary').textContent = app.ui.formatCurrency(order.total);
                    ordersList.appendChild(clone);
                });
            }
        },

        formatStatus(status) {
            const statuses = { "RECIBIDO": "Recibido", "EN_PREPARACION": "En Preparación", "EN_CAMINO": "En Camino", "ENTREGADO": "Entregado", "CANCELADO": "Cancelado" };
            return statuses[status] || 'Desconocido';
        },

        getStatusColor(status) {
            const colors = { "ENTREGADO": "bg-green-100 text-green-800", "EN_CAMO": "bg-blue-100 text-blue-800", "EN_PREPARACION": "bg-yellow-100 text-yellow-800", "RECIBIDO": "bg-yellow-100 text-yellow-800", "CANCELADO": "bg-red-100 text-red-800" };
            return colors[status] || 'bg-gray-100 text-gray-800';
        }
    },

    // =====================================================================
    // MÓDULO 6: UTILIDADES Y PWA
    // =====================================================================
    ui: {
        formatCurrency(value) {
            return new Intl.NumberFormat('es-CO', {
                style: 'currency',
                currency: 'COP',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(value);
        },

        showToast(message, type = 'info') {
            console.log(`[Toast: ${type}] ${message}`);

            const toast = document.createElement('div');
            let bgColor = 'bg-brand-dark'; // info
            if (type === 'success') bgColor = 'bg-brand-primary';
            if (type === 'error') bgColor = 'bg-red-600';
            if (type === 'warning') bgColor = 'bg-brand-secondary';

            toast.className = `fixed top-5 right-5 ${bgColor} text-white px-6 py-3 rounded-lg shadow-xl transition-all duration-300 transform translate-x-full z-[110]`;
            toast.textContent = message;

            document.body.appendChild(toast);

            setTimeout(() => {
                toast.classList.remove('translate-x-full');
                toast.classList.add('translate-x-0');
            }, 100);

            setTimeout(() => {
                toast.classList.add('translate-x-full');
                toast.classList.remove('translate-x-0');
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 300);
            }, 3000);
        },

        toggleLoginTabs(showLogin) {
            document.getElementById('login-tab-btn').classList.toggle('text-brand-primary', showLogin);
            document.getElementById('login-tab-btn').classList.toggle('border-brand-primary', showLogin);
            document.getElementById('login-tab-btn').classList.toggle('text-brand-gray', !showLogin);
            document.getElementById('register-tab-btn').classList.toggle('text-brand-primary', !showLogin);
            document.getElementById('register-tab-btn').classList.toggle('border-brand-primary', !showLogin);
            document.getElementById('register-tab-btn').classList.toggle('text-brand-gray', showLogin);
            document.getElementById('login-form').classList.toggle('hidden', !showLogin);
            document.getElementById('register-form').classList.toggle('hidden', showLogin);
        },

        updateLoginState(isLoggedIn, name = '') {
            document.getElementById('desktop-login-btn').classList.toggle('hidden', isLoggedIn);
            document.getElementById('mobile-login-btn').classList.toggle('hidden', isLoggedIn);
            document.getElementById('desktop-logout-btn').classList.toggle('hidden', !isLoggedIn);
            document.getElementById('mobile-logout-btn').classList.toggle('hidden', !isLoggedIn);
        }
    },

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js') // El index.html está en la raíz, sw.js también.
                .then(registration => console.log('Service Worker registrado:', registration))
                .catch(error => console.error('Error al registrar Service Worker:', error));
        } else {
            console.warn('Service Worker no es soportado.');
        }
    },

    loadCartFromStorage() {
        const savedCart = localStorage.getItem('sazonCart');
        if (savedCart) {
            state.cart = JSON.parse(savedCart);
        }
    },

    // Funciones de utilidad para el 'onclick' del HTML
    showLoginModal() {
        document.getElementById('login-modal').style.display = 'block';
        document.body.classList.add('modal-open');
    },

    hideLoginModal() {
        document.getElementById('login-modal').style.display = 'none';
        document.body.classList.remove('modal-open');
    }
};

// =====================================================================
// INICIO DE LA APLICACIÓN
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
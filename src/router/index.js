import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../api/auth'

import HomeView from '../views/HomeView.vue'
import ArticleView from '../views/ArticleView.vue'
import CategoryView from '../views/CategoryView.vue'
import SearchView from '../views/SearchView.vue'
import AboutView from '../views/AboutView.vue'
import RegisterView from '../views/RegisterView.vue'
import ReaderLoginView from '../views/ReaderLoginView.vue'
import WriterProfileView from '../views/WriterProfileView.vue'
import AdPreviewView from '../views/AdPreviewView.vue'
import SavedArticlesView from '../views/SavedArticlesView.vue'
import AdminMediaView from '../views/admin/AdminMediaView.vue'
import ProfileView from '../views/admin/ProfileView.vue'
import AuditLogView from '../views/admin/AuditLogView.vue'

import AdminLoginView from '../views/admin/AdminLoginView.vue'
import AdminLayout from '../views/admin/AdminLayout.vue'
import AdminDashboardView from '../views/admin/AdminDashboardView.vue'
import AdminEditorView from '../views/admin/AdminEditorView.vue'
import AdminUsersView from '../views/admin/AdminUsersView.vue'
import AdminUserEditView from '../views/admin/AdminUserEditView.vue'
import AdminTrashView from '../views/admin/AdminTrashView.vue'
import MyArticlesView from '../views/admin/MyArticlesView.vue'
import AdminReviewView from '../views/admin/AdminReviewView.vue'
import AdminReadyView from '../views/admin/AdminReadyView.vue'
import AdminCategoriesView from '../views/admin/AdminCategoriesView.vue'
import AdminEarningsView from '../views/admin/AdminEarningsView.vue'
import AdminAdsView from '../views/admin/AdminAdsView.vue'
import AdminInteractionsView from '../views/admin/AdminInteractionsView.vue'
import ChatView from '../views/admin/ChatView.vue'

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/berita/:id', name: 'article', component: ArticleView, props: true },
  {
    path: '/penulis/:username',
    name: 'writer-profile',
    component: WriterProfileView,
    props: true,
  },
  {
    path: '/preview/:id',
    name: 'preview',
    component: ArticleView,
    props: (route) => ({ id: route.params.id, preview: true }),
    meta: { requiresAuth: true },
  },
  { path: '/kategori/:category', name: 'category', component: CategoryView, props: true },
  { path: '/cari', name: 'search', component: SearchView },
  { path: '/tentang', name: 'about', component: AboutView },
  { path: '/pratinjau-iklan', name: 'ad-preview', component: AdPreviewView },
  { path: '/disimpan', name: 'saved-articles', component: SavedArticlesView },
  { path: '/daftar', name: 'register', component: RegisterView, meta: { guestOnly: true } },
  {
    path: '/masuk',
    name: 'reader-login',
    component: ReaderLoginView,
    meta: { guestOnly: true },
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: AdminLoginView,
    meta: { guestOnly: true },
  },
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'admin-dashboard', component: AdminDashboardView },
      { path: 'berita-saya', name: 'admin-my-articles', component: MyArticlesView },
      {
        path: 'tinjauan',
        name: 'admin-review',
        component: AdminReviewView,
        meta: { requiresRole: ['editor'], anyPermission: 'publish' },
      },
      {
        path: 'siap-terbit',
        name: 'admin-ready',
        component: AdminReadyView,
        meta: { requiresRole: ['editor'], anyPermission: 'publish' },
      },
      {
        path: 'kategori',
        name: 'admin-categories',
        component: AdminCategoriesView,
        meta: { requiresRole: 'editor' },
      },
      { path: 'tulis', name: 'admin-create', component: AdminEditorView },
      { path: 'edit/:id', name: 'admin-edit', component: AdminEditorView, props: true },
      {
        path: 'users',
        name: 'admin-users',
        component: AdminUsersView,
        meta: { requiresRole: 'admin', anyPermission: 'manageUsers' },
      },
      {
        path: 'users/:id/edit',
        name: 'admin-user-edit',
        component: AdminUserEditView,
        meta: { requiresRole: 'admin', anyPermission: 'manageUsers' },
      },
      {
        path: 'rekap-penghasilan',
        name: 'admin-earnings',
        component: AdminEarningsView,
        meta: { requiresRole: 'admin' },
      },
      {
        path: 'iklan',
        name: 'admin-ads',
        component: AdminAdsView,
        meta: { requiresRole: 'admin' },
      },
      {
        path: 'media',
        name: 'admin-media',
        component: AdminMediaView,
        meta: { requiresRole: ['admin', 'editor'], anyPermission: 'editAll' },
      },
      {
        // Semua role bisa melihat interaksi pembaca (admin: semua artikel;
        // penulis/editor: artikel miliknya + bisa membalas komentar)
        path: 'interaksi',
        name: 'admin-interactions',
        component: AdminInteractionsView,
      },
      {
        path: 'sampah',
        name: 'admin-trash',
        component: AdminTrashView,
        meta: { requiresRole: ['admin', 'editor'], anyPermission: 'manageTrash' },
      },
      {
        path: 'pesan',
        name: 'admin-chat',
        component: ChatView,
      },
      {
        path: 'profil',
        name: 'admin-profile',
        component: ProfileView,
      },
      {
        path: 'audit',
        name: 'admin-audit',
        component: AuditLogView,
        meta: { requiresRole: 'admin', anyPermission: 'viewAudit' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

// Guard: proteksi halaman backoffice, halaman login, dan akses berbasis role + izin granular
router.beforeEach((to) => {
  const user = auth.current()
  // Pembaca tidak boleh masuk backoffice
  if (to.meta.requiresAuth && user?.role === 'reader') {
    return { path: '/' }
  }
  if (to.meta.requiresAuth && !user) {
    return { name: 'admin-login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && user) {
    // Halaman masuk pembaca: user sudah login → ke beranda
    if (to.name === 'reader-login') return { path: '/' }
    return { name: 'admin-dashboard' }
  }

  // Halaman tulis: admin tidak boleh membuat artikel (tidak ada izin "create")
  if (to.name === 'admin-create' && user?.role === 'admin') {
    return { name: 'admin-dashboard' }
  }
  // Halaman edit: admin hanya boleh jika diberi izin granular editAll
  if (to.name === 'admin-edit' && user?.role === 'admin' && !auth.hasPermission('editAll')) {
    return { name: 'admin-dashboard' }
  }

  // Halaman ber-role: boleh lewat role default ATAU izin granular yang diberikan
  const allowedRoles = Array.isArray(to.meta.requiresRole)
    ? to.meta.requiresRole
    : [to.meta.requiresRole]
  const roleOk = !!to.meta.requiresRole && !!user && allowedRoles.includes(user.role)
  const permOk = !!to.meta.anyPermission && !!user && auth.hasPermission(to.meta.anyPermission)
  if ((to.meta.requiresRole || to.meta.anyPermission) && !roleOk && !permOk) {
    return { name: 'admin-dashboard' }
  }
})

export default router

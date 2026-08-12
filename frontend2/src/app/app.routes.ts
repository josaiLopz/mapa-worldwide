import { Routes } from '@angular/router';
import { MapEditorComponent } from './pages/map-editor/map-editor.component';
import { PublicMapComponent } from './pages/public-map/public-map.component';
import { AdminLoginComponent } from './pages/admin-login/admin-login.component';
import { AdminRegisterComponent } from './pages/admin-register/admin-register.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: PublicMapComponent
  },
  {
    path: 'map-editor',
    redirectTo: 'admin/map-editor',
    pathMatch: 'full'
  },
  {
    path: 'admin/login',
    component: AdminLoginComponent
  },
  {
    path: 'admin/registro',
    component: AdminRegisterComponent
  },
  {
    path: 'admin/map-editor',
    component: MapEditorComponent,
    canActivate: [authGuard]
  }
];

<?php

namespace App\Http\Controllers;
use App\Models\Local;
use App\Models\LocalComponente;
use App\Models\Mapa_objetos;
use App\Models\Productos;
use App\Models\Servicios;
use Illuminate\Http\Request;

class BusquedaController extends Controller
{
      public function global($texto)
    {
        $locales = Local::with(['productos', 'servicios', 'objetosMapa', 'componentes'])
            ->where('activo', true)
            ->where(function ($query) use ($texto) {
                $query->where('nombre', 'like', "%{$texto}%")
                    ->orWhere('numero_local', 'like', "%{$texto}%")
                    ->orWhere('descripcion', 'like', "%{$texto}%")
                    ->orWhere('horario', 'like', "%{$texto}%")
                    ->orWhere('telefono', 'like', "%{$texto}%")
                    ->orWhere('correo', 'like', "%{$texto}%");
            })
            ->get();

        $productos = Productos::with('local')
            ->whereHas('local', fn ($query) => $query->where('activo', true))
            ->where(function ($query) use ($texto) {
                $query->where('nombre', 'like', "%{$texto}%")
                    ->orWhere('descripcion', 'like', "%{$texto}%");
            })
            ->get();

        $servicios = Servicios::with('local')
            ->whereHas('local', fn ($query) => $query->where('activo', true))
            ->where(function ($query) use ($texto) {
                $query->where('nombre', 'like', "%{$texto}%")
                    ->orWhere('descripcion', 'like', "%{$texto}%");
            })
            ->get();

        $mapaObjetos = Mapa_objetos::with('local')
            ->where(function ($query) {
                $query->whereNull('local_id')->orWhereHas('local', fn ($localQuery) => $localQuery->where('activo', true));
            })
            ->where(function ($query) use ($texto) {
                $query->where('nombre', 'like', "%{$texto}%")
                    ->orWhere('tipo', 'like', "%{$texto}%");
            })
            ->get();

        $componentes = LocalComponente::with('local')
            ->where('activo', true)
            ->where(function ($query) {
                $query->whereNull('local_id')
                    ->orWhereHas('local', fn ($localQuery) => $localQuery->where('activo', true));
            })
            ->where(function ($query) use ($texto) {
                $query->where('nombre', 'like', "%{$texto}%")
                    ->orWhere('tipo', 'like', "%{$texto}%")
                    ->orWhere('descripcion', 'like', "%{$texto}%");
            })
            ->get();

        return response()->json([
            'locales' => $locales,
            'productos' => $productos,
            'servicios' => $servicios,
            'mapa_objetos' => $mapaObjetos,
            'componentes' => $componentes,
        ]);
    }
}

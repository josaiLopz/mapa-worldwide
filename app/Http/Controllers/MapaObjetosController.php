<?php

namespace App\Http\Controllers;

use App\Models\Mapa_objetos;
use Illuminate\Http\Request;
use App\Http\Requests\Mapa_objetosRequest;

class MapaObjetosController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $publicView = request()->boolean('public');
        $query = Mapa_objetos::with(['local.productos', 'local.servicios', 'local.componentes'])
            ->when(request('mapa_id'), function ($query, $mapaId) {
                $query->where('mapa_id', $mapaId);
            });

        if ($publicView || !$this->currentUser()) {
            $query->where(function ($query) {
                $query->whereNull('local_id')->orWhereHas('local', fn ($localQuery) => $localQuery->where('activo', true));
            });
            $query->with(['local.componentes' => fn ($componentes) => $componentes->where('activo', true)]);
        }

        return $query
            ->orderBy('id')
            ->get();
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Mapa_objetosRequest $request)
    {
        $data = $request->validated();
        if (empty($data['local_id'])) {
            $this->ensureSuperadmin();
        }
        $this->ensureLocalAccess($data['local_id'] ?? null);

        return Mapa_objetos::create($data)->load('local.productos', 'local.servicios', 'local.componentes');
    }

    /**
     * Display the specified resource.
     */
    public function show(Mapa_objetos $mapa_objeto)
    {
        if ($this->currentUser()) {
            $this->ensureLocalAccess($mapa_objeto->local_id);
        }

         return $mapa_objeto->load('local.productos', 'local.servicios', 'local.componentes');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Mapa_objetos $mapa_objeto)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Mapa_objetosRequest $request, Mapa_objetos $mapa_objeto)
    {
        $this->ensureLocalAccess($mapa_objeto->local_id);
        $data = $request->validated();
        if (empty($mapa_objeto->local_id) || empty($data['local_id'])) {
            $this->ensureSuperadmin();
        }
        $this->ensureLocalAccess($data['local_id'] ?? null);

        $mapa_objeto->update($data);

        return $mapa_objeto->load('local.productos', 'local.servicios', 'local.componentes');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Mapa_objetos $mapa_objeto)
    {
        $this->ensureLocalAccess($mapa_objeto->local_id);
        if (empty($mapa_objeto->local_id)) {
            $this->ensureSuperadmin();
        }

        $mapa_objeto->delete();

        return response()->json([
            'message' => 'objeto del mapa eliminado'
        ]);
    }
}

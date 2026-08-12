<?php

namespace App\Http\Controllers;

use App\Models\Servicios;
use Illuminate\Http\Request;
use App\Http\Requests\ServiciosRequest;

class ServiciosController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $query = Servicios::with('local');

        if ($this->currentUser() && !$this->isSuperadmin()) {
            $ids = $this->currentUser()->locales()->pluck('locals.id');
            $query->whereIn('local_id', $ids);
        } elseif (!$this->currentUser()) {
            $query->whereHas('local', fn ($localQuery) => $localQuery->where('activo', true));
        }

        return $query->orderBy('nombre')->get();
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
    public function store(ServiciosRequest $request)
    {
        $data = $request->validated();
        $this->ensureLocalAccess((int) $data['local_id']);

        return Servicios::create($data);
    }

    /**
     * Display the specified resource.
     */
    public function show(Servicios $servicio)
    {
        if ($this->currentUser()) {
            $this->ensureLocalAccess($servicio->local_id);
        }

        return $servicio->load('local');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(ServiciosRequest $request, Servicios $servicio)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(ServiciosRequest $request, Servicios $servicio)
    {
        $this->ensureLocalAccess($servicio->local_id);
        $data = $request->validated();
        $this->ensureLocalAccess((int) $data['local_id']);

        $servicio->update($data);

        return $servicio;
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Servicios $servicio)
    {
        $this->ensureLocalAccess($servicio->local_id);

        $servicio->delete();

        return response()->json([
            'message' => 'Servicio eliminado'
        ]);
    }
    public function buscar($texto)
    {
        return Servicios::with('local')
            ->where('nombre', 'like', "%{$texto}%")
            ->orWhere('descripcion', 'like', "%{$texto}%")
            ->get();
    }
}

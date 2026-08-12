<?php

namespace App\Http\Controllers;

use App\Models\Productos;
use Illuminate\Http\Request;
use App\Http\Requests\ProductosRequest;

class ProductosController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $query = Productos::with('local');

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
    public function store(ProductosRequest $request)
    {
        $data = $request->validated();
        $this->ensureLocalAccess((int) $data['local_id']);

        return Productos::create($data);
    }

    /**
     * Display the specified resource.
     */
    public function show(Productos $producto)
    {
        if ($this->currentUser()) {
            $this->ensureLocalAccess($producto->local_id);
        }

         return $producto->load('local');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Productos $producto)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(ProductosRequest $request, Productos $producto)
    {
        $this->ensureLocalAccess($producto->local_id);
        $data = $request->validated();
        $this->ensureLocalAccess((int) $data['local_id']);

        $producto->update($data);

        return $producto;
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Productos $producto)
    {
        $this->ensureLocalAccess($producto->local_id);

        $producto->delete();

        return response()->json([
            'message' => 'Producto eliminado'
        ]);
    }
    
    public function buscar($texto)
    {
        return Productos::with('local')
            ->where('nombre', 'like', "%{$texto}%")
            ->orWhere('descripcion', 'like', "%{$texto}%")
            ->get();
    }
}

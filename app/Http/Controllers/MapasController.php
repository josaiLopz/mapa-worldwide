<?php

namespace App\Http\Controllers;

use App\Models\Mapas;
use Illuminate\Http\Request;
use App\Http\Requests\MapasRequest;

class MapasController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
         return Mapas::all();
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
    public function store(MapasRequest $request)
    {
        $this->ensureSuperadmin();

        return Mapas::create(
            $request->validated()
        );
    }

    /**
     * Display the specified resource.
     */
    public function show(Mapas $mapa)
    {
        return $mapa;
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Mapas $mapa)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(MapasRequest $request, Mapas $mapa)
    {
        $this->ensureSuperadmin();

        $mapa->update(
            $request->validated()
        );

        return $mapa;
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Mapas $mapa)
    {
        $this->ensureSuperadmin();

        $mapa->delete();

        return response()->json([
            'message' => 'Mapa eliminado'
        ]);
    }
}

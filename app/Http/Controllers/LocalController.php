<?php

namespace App\Http\Controllers;

use App\Models\Local;
use App\Models\Productos;
use App\Models\Servicios;
use Illuminate\Http\Request;
use App\Http\Requests\LocalRequest;
use Illuminate\Support\Facades\Storage;

class LocalController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $publicView = request()->boolean('public');

        $query = Local::with(['productos', 'servicios', 'objetosMapa', 'componentes' => function ($query) use ($publicView) {
            if ($publicView || !auth('api')->user()) {
                $query->where('activo', true);
            }
        }]);

        if ($publicView || !$this->currentUser()) {
            $query->where('activo', true);
        }

         return response()->json(
            $query
                ->orderByRaw('CASE WHEN numero_local IS NULL OR numero_local = "" THEN 1 ELSE 0 END')
                ->orderBy('numero_local')
                ->orderBy('nombre')
                ->get()
        );
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
    public function store(LocalRequest $request)
    {
        $this->ensureSuperadmin();

        $local = Local::create(
            $request->validated()
        );

        return response()->json($local->load(['productos', 'servicios', 'objetosMapa', 'componentes']), 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Local $locale)
    {
        if ($this->currentUser()) {
            $this->ensureLocalAccess($locale);
        } else {
            abort_unless($locale->activo, 404);
        }

        return response()->json($locale->load(['productos', 'servicios', 'objetosMapa', 'componentes']));

    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Local $locale)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(LocalRequest $request, Local $locale)
    {
        $this->ensureLocalAccess($locale);

        $locale->update(
            $request->validated()
        );

        return response()->json($locale->load(['productos', 'servicios', 'objetosMapa', 'componentes']));
    }

    public function updateInformacion(Request $request, Local $locale)
    {
        $this->ensureLocalAccess($locale);

        $validated = $request->validate([
            'numero_local' => 'nullable|string|max:50',
            'nombre' => 'required|string|max:150',
            'descripcion' => 'nullable|string',
            'horario' => 'nullable|string',
            'logo' => 'nullable|string|max:255',
            'telefono' => 'nullable|string|max:30',
            'correo' => 'nullable|email|max:255',
            'facebook' => 'nullable|string|max:255',
            'instagram' => 'nullable|string|max:255',
            'tiktok' => 'nullable|string|max:255',
            'youtube' => 'nullable|string|max:255',
            'x' => 'nullable|string|max:255',
            'telegram' => 'nullable|string|max:255',
            'whatsapp' => 'nullable|string|max:255',
            'sitio_web' => 'nullable|string|max:255',
            'activo' => 'nullable|boolean',
            'productos' => 'nullable|array',
            'productos.*.nombre' => 'required_with:productos|string|max:200',
            'productos.*.descripcion' => 'nullable|string',
            'productos.*.precio' => 'nullable|numeric|min:0',
            'servicios' => 'nullable|array',
            'servicios.*.nombre' => 'required_with:servicios|string|max:200',
            'servicios.*.descripcion' => 'nullable|string',
        ]);

        $productos = $validated['productos'] ?? [];
        $servicios = $validated['servicios'] ?? [];
        unset($validated['productos'], $validated['servicios']);

        $locale->update($validated);

        $locale->productos()->delete();
        foreach ($productos as $producto) {
            $locale->productos()->create([
                'nombre' => $producto['nombre'],
                'descripcion' => $producto['descripcion'] ?? null,
                'precio' => $producto['precio'] ?? null,
                'activo' => true,
            ]);
        }

        $locale->servicios()->delete();
        foreach ($servicios as $servicio) {
            $locale->servicios()->create([
                'nombre' => $servicio['nombre'],
                'descripcion' => $servicio['descripcion'] ?? null,
                'activo' => true,
            ]);
        }

        return response()->json($locale->load(['productos', 'servicios', 'objetosMapa', 'componentes']));
    }

    public function uploadLogo(Request $request, Local $locale)
    {
        $this->ensureLocalAccess($locale);

        $request->validate([
            'logo' => 'required|file|mimes:jpg,jpeg,png,svg,webp|max:2048',
        ]);

        if ($locale->logo && str_starts_with($locale->logo, '/storage/logos/')) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $locale->logo));
        }

        $path = $request->file('logo')->store('logos', 'public');
        $locale->update([
            'logo' => Storage::url($path),
        ]);

        return response()->json($locale->load(['productos', 'servicios', 'objetosMapa', 'componentes']));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Local $locale)
    {
        $this->ensureSuperadmin();

        $locale->objetosMapa()->delete();
        $locale->delete();

        return response()->json([
            'message' => 'Local eliminado'
        ]);
    }
}

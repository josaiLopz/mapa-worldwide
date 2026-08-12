<?php

namespace App\Http\Controllers;

use App\Models\LocalComponente;
use App\Models\Mapa_objetos;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class LocalComponenteController extends Controller
{
    public function index()
    {
        $query = LocalComponente::with('local')
            ->when(request('local_id'), fn ($query, $localId) => $query->where('local_id', $localId));

        if ($this->currentUser() && !$this->isSuperadmin()) {
            $ids = $this->currentUser()->locales()->pluck('locals.id');
            $query->whereIn('local_id', $ids);
        }

        if (!$this->currentUser()) {
            $query->where('activo', true);
        }

        return response()->json($query->orderBy('tipo')->orderBy('nombre')->get());
    }

    public function store(Request $request)
    {
        $data = $this->validatedData($request);
        $this->authorizeLocalId($data['local_id'] ?? null);

        $componente = LocalComponente::create($data);

        return response()->json($componente->load('local'), 201);
    }

    public function show(LocalComponente $componente)
    {
        if ($this->currentUser()) {
            $this->authorizeLocalId($componente->local_id);
        }

        abort_if(!$this->currentUser() && !$componente->activo, 404);

        return response()->json($componente->load('local'));
    }

    public function update(Request $request, LocalComponente $componente)
    {
        $this->authorizeLocalId($componente->local_id);

        $data = $this->validatedData($request);
        $this->authorizeLocalId($data['local_id'] ?? null);

        $componente->update($data);

        $this->mapObjectsForComponent($componente->id)->update([
            'local_id' => $componente->local_id,
            'nombre' => $componente->nombre,
        ]);

        return response()->json($componente->load('local'));
    }

    public function destroy(LocalComponente $componente)
    {
        $this->authorizeLocalId($componente->local_id);
        $this->mapObjectsForComponent($componente->id)->delete();
        $this->deleteStoredFile($componente->imagen, '/storage/componentes/');
        $this->deleteStoredFile($componente->icono, '/storage/componentes/');
        $componente->delete();

        return response()->json(['message' => 'Componente eliminado']);
    }

    public function uploadFile(Request $request, LocalComponente $componente, string $campo)
    {
        $this->authorizeLocalId($componente->local_id);
        abort_unless(in_array($campo, ['imagen', 'icono'], true), 404);

        $request->validate([
            'file' => 'required|file|mimes:jpg,jpeg,png,svg,webp|max:10240',
        ]);

        $this->deleteStoredFile($componente->{$campo}, '/storage/componentes/');
        $path = $request->file('file')->store('componentes', 'public');
        $componente->update([$campo => Storage::url($path)]);

        return response()->json($componente->load('local'));
    }

    public function deleteFile(LocalComponente $componente, string $campo)
    {
        $this->authorizeLocalId($componente->local_id);
        abort_unless(in_array($campo, ['imagen', 'icono'], true), 404);

        $this->deleteStoredFile($componente->{$campo}, '/storage/componentes/');
        $componente->update([$campo => null]);

        return response()->json($componente->load('local'));
    }

    private function validatedData(Request $request): array
    {
        return $request->validate([
            'local_id' => 'nullable|integer|exists:locals,id',
            'tipo' => 'required|string|max:100',
            'nombre' => 'required|string|max:150',
            'descripcion' => 'nullable|string',
            'costo' => 'nullable|numeric|min:0',
            'imagen' => 'nullable|string|max:255',
            'icono' => 'nullable|string|max:255',
            'activo' => 'nullable|boolean',
        ]);
    }

    private function authorizeLocalId(?int $localId): void
    {
        if ($localId === null) {
            $this->ensureSuperadmin();
            return;
        }

        $this->ensureLocalAccess($localId);
    }

    private function mapObjectsForComponent(int $componentId)
    {
        return Mapa_objetos::query()->whereRaw(
            "CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.component_id')) AS CHAR) = ?",
            [(string) $componentId]
        );
    }

    private function deleteStoredFile(?string $file, string $prefix): void
    {
        if ($file && str_starts_with($file, $prefix)) {
            Storage::disk('public')->delete(str_replace('/storage/', '', $file));
        }
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index()
    {
        $this->ensureSuperadmin();

        return response()->json(
            User::with('locales')
                ->orderBy('name')
                ->get()
        );
    }

    public function store(Request $request)
    {
        $this->ensureSuperadmin();

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'role' => ['required', Rule::in(['superadmin', 'admin_local'])],
            'status' => 'nullable|boolean',
            'local_ids' => 'nullable|array',
            'local_ids.*' => 'integer|exists:locals,id',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => $data['role'],
            'status' => $data['status'] ?? true,
        ]);

        $user->locales()->sync($data['role'] === 'admin_local' ? ($data['local_ids'] ?? []) : []);

        return response()->json($user->load('locales'), 201);
    }

    public function show(User $user)
    {
        $this->ensureSuperadmin();

        return response()->json($user->load('locales'));
    }

    public function update(Request $request, User $user)
    {
        $this->ensureSuperadmin();

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => 'nullable|string|min:6',
            'role' => ['required', Rule::in(['superadmin', 'admin_local'])],
            'status' => 'nullable|boolean',
            'local_ids' => 'nullable|array',
            'local_ids.*' => 'integer|exists:locals,id',
        ]);

        $payload = [
            'name' => $data['name'],
            'email' => $data['email'],
            'role' => $data['role'],
            'status' => $data['status'] ?? true,
        ];

        if (!empty($data['password'])) {
            $payload['password'] = Hash::make($data['password']);
        }

        $user->update($payload);
        $user->locales()->sync($data['role'] === 'admin_local' ? ($data['local_ids'] ?? []) : []);

        return response()->json($user->load('locales'));
    }

    public function destroy(User $user)
    {
        $this->ensureSuperadmin();
        $user->update(['status' => false]);

        return response()->json(['message' => 'Usuario desactivado']);
    }

    public function forceDestroy(User $user)
    {
        $this->ensureSuperadmin();
        abort_if($this->currentUser()?->id === $user->id, 422, 'No puedes eliminar tu propio usuario.');

        $user->locales()->detach();
        $user->delete();

        return response()->json(['message' => 'Usuario eliminado']);
    }
}

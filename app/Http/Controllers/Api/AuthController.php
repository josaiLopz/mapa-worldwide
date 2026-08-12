<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
            'local_id' => ['required', 'integer', 'exists:locals,id'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => 'admin_local',
            'status' => true,
        ]);

        $user->locales()->sync([$data['local_id']]);

        $token = Auth::guard('api')->login($user);

        return response()->json([
            'success' => true,
            'token' => $token,
            'user' => $user->load('locales'),
        ], 201);
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (!$token = Auth::guard('api')->attempt($credentials)) {
            return response()->json([
                'success' => false,
                'message' => 'Credenciales incorrectas',
            ], 401);
        }

        $user = Auth::guard('api')->user();

        if (!$user->status) {
            Auth::guard('api')->logout();

            return response()->json([
                'success' => false,
                'message' => 'Usuario inactivo',
            ], 403);
        }

        if (!in_array($user->role, ['superadmin', 'admin', 'admin_local'], true)) {
            Auth::guard('api')->logout();

            return response()->json([
                'success' => false,
                'message' => 'El usuario no tiene acceso administrativo',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'token' => $token,
            'user' => $user->load('locales'),
        ]);
    }

    public function me()
    {
        return response()->json(Auth::guard('api')->user()->load('locales'));
    }

    public function logout()
    {
        Auth::guard('api')->logout();

        return response()->json([
            'success' => true,
            'message' => 'Sesion cerrada',
        ]);
    }
}

<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\AdminSettingController;
use App\Http\Controllers\BusquedaController;
use App\Http\Controllers\LocalController;
use App\Http\Controllers\LocalComponenteController;
use App\Http\Controllers\MapaObjetosController;
use App\Http\Controllers\MapasController;
use App\Http\Controllers\ProductosController;
use App\Http\Controllers\ServiciosController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

Route::get('buscar/{texto}', [BusquedaController::class, 'global']);
Route::get('productos/buscar/{texto}', [ProductosController::class, 'buscar']);
Route::get('servicios/buscar/{texto}', [ServiciosController::class, 'buscar']);
Route::get('admin-settings', [AdminSettingController::class, 'show']);

Route::apiResource('locales', LocalController::class)->only(['index', 'show']);
Route::apiResource('componentes', LocalComponenteController::class)->only(['index', 'show']);
Route::apiResource('productos', ProductosController::class)->only(['index', 'show']);
Route::apiResource('servicios', ServiciosController::class)->only(['index', 'show']);
Route::apiResource('mapas', MapasController::class)->only(['index', 'show']);
Route::apiResource('mapa_objetos', MapaObjetosController::class)->only(['index', 'show']);

Route::middleware('auth:api')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::put('locales/{locale}/informacion', [LocalController::class, 'updateInformacion']);
    Route::post('locales/{locale}/logo', [LocalController::class, 'uploadLogo']);
    Route::put('admin-settings', [AdminSettingController::class, 'update']);
    Route::post('admin-settings/logo', [AdminSettingController::class, 'uploadLogo']);
    Route::post('componentes/{componente}/{campo}/archivo', [LocalComponenteController::class, 'uploadFile']);
    Route::delete('componentes/{componente}/{campo}/archivo', [LocalComponenteController::class, 'deleteFile']);
    Route::delete('usuarios/{user}/eliminar', [UserController::class, 'forceDestroy']);

    Route::apiResource('usuarios', UserController::class)->parameters([
        'usuarios' => 'user',
    ]);
    Route::apiResource('locales', LocalController::class)->except(['index', 'show']);
    Route::apiResource('componentes', LocalComponenteController::class)->except(['index', 'show']);
    Route::apiResource('productos', ProductosController::class)->except(['index', 'show']);
    Route::apiResource('servicios', ServiciosController::class)->except(['index', 'show']);
    Route::apiResource('mapas', MapasController::class)->except(['index', 'show']);
    Route::apiResource('mapa_objetos', MapaObjetosController::class)->except(['index', 'show']);
});

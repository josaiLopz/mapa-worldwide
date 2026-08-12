<?php

namespace App\Models;
use App\Models\Productos;
use App\Models\Servicios;
use Illuminate\Database\Eloquent\Model;

class Local extends Model
{
   protected $fillable = [
        'numero_local',
        'nombre',
        'horario',
        'descripcion',
        'logo',
        'telefono',
        'correo',
        'facebook',
        'instagram',
        'tiktok',
        'youtube',
        'x',
        'telegram',
        'whatsapp',
        'sitio_web',
        'activo'
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function productos()
    {
        return $this->hasMany(Productos::class);
    }
    public function servicios()
    {
        return $this->hasMany(Servicios::class);
    }

    public function objetosMapa()
    {
        return $this->hasMany(Mapa_objetos::class, 'local_id');
    }

    public function componentes()
    {
        return $this->hasMany(LocalComponente::class, 'local_id');
    }

    public function usuarios()
    {
        return $this->belongsToMany(User::class, 'local_user');
    }
}

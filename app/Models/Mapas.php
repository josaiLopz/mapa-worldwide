<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Mapas extends Model
{
     protected $fillable = [
        'nombre',
        'descripcion',
        'ancho',
        'alto',
        'niveles',
        'activo'
    ];

    public function objetos()
    {
        return $this->hasMany(Mapa_objetos::class, 'mapa_id');
    }
}

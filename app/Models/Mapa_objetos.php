<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Mapa_objetos extends Model
{
    protected $table = 'mapa_objetos';

    protected $fillable = [
        'mapa_id',
        'local_id',
        'tipo',
        'nombre',
        'x',
        'y',
        'width',
        'height',
        'rotation',
        'color',
        'metadata'
    ];

    protected $casts = [
        'metadata' => 'array',
        'x' => 'integer',
        'y' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
        'rotation' => 'integer',
    ];
        
    public function local()
    {
        return $this->belongsTo(Local::class);
    }

    public function mapa()
    {
        return $this->belongsTo(Mapas::class, 'mapa_id');
    }
}

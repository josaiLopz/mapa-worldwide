<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LocalComponente extends Model
{
    protected $table = 'local_componentes';

    protected $fillable = [
        'local_id',
        'tipo',
        'nombre',
        'descripcion',
        'costo',
        'imagen',
        'icono',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'costo' => 'decimal:2',
    ];

    public function local()
    {
        return $this->belongsTo(Local::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Productos extends Model
{
    protected $fillable = [
        'local_id',
        'nombre',
        'descripcion',
        'precio',
        'imagen',
        'activo'
    ];

    public function local()
    {
        return $this->belongsTo(Local::class);
    }
}

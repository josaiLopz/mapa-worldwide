<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Servicios extends Model
{
        protected $fillable = [
        'local_id',
        'nombre',
        'descripcion',
        'activo'
    ];

    public function local()
    {
        return $this->belongsTo(Local::class);
    }
}

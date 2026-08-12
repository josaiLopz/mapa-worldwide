<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('local_componentes', function (Blueprint $table) {
            $table->unsignedBigInteger('local_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // No se pueden conservar componentes generales al volver a una columna obligatoria.
        \App\Models\LocalComponente::whereNull('local_id')->delete();

        Schema::table('local_componentes', function (Blueprint $table) {
            $table->unsignedBigInteger('local_id')->nullable(false)->change();
        });
    }
};

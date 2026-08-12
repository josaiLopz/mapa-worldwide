<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('local_componentes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('local_id')->constrained('locals')->cascadeOnDelete();
            $table->string('tipo', 100)->default('otros');
            $table->string('nombre', 150);
            $table->text('descripcion')->nullable();
            $table->decimal('costo', 10, 2)->nullable();
            $table->string('imagen')->nullable();
            $table->string('icono')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('local_componentes');
    }
};

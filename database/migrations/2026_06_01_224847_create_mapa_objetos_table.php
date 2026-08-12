<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('mapa_objetos', function (Blueprint $table) {

            $table->id();

            $table->foreignId('mapa_id')
                ->constrained('mapas')
                ->cascadeOnDelete();

            $table->foreignId('local_id')
                ->nullable()
                ->constrained('locals')
                ->nullOnDelete();

            $table->string('tipo');

            $table->string('nombre')->nullable();

            $table->integer('x');

            $table->integer('y');

            $table->integer('width');

            $table->integer('height');

            $table->integer('rotation')->default(0);

            $table->string('color')->default('#cccccc');

            $table->json('metadata')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mapa_objetos');
    }
};

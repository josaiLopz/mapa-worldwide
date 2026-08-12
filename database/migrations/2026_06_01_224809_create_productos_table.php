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
        Schema::create('productos', function (Blueprint $table) {

            $table->id();

            $table->foreignId('local_id')
                ->constrained('locals')
                ->cascadeOnDelete();

            $table->string('nombre', 200);

            $table->text('descripcion')->nullable();

            $table->decimal('precio', 10, 2)->nullable();

            $table->string('imagen')->nullable();

            $table->boolean('activo')->default(true);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('productos');
    }
};

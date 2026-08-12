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
        Schema::create('locals', function (Blueprint $table) {

            $table->id();

            $table->string('nombre', 150);

            $table->text('descripcion')->nullable();

            $table->string('logo')->nullable();

            $table->string('telefono', 30)->nullable();

            $table->string('correo')->nullable();

            $table->string('facebook')->nullable();

            $table->string('instagram')->nullable();

            $table->string('tiktok')->nullable();

            $table->string('whatsapp')->nullable();

            $table->string('sitio_web')->nullable();

            $table->boolean('activo')->default(true);

            $table->timestamps();
        });
    }


    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('locals');
    }
};

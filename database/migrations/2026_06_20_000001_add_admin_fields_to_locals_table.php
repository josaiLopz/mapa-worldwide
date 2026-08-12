<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locals', function (Blueprint $table) {
            $table->string('numero_local', 50)->nullable()->after('id');
            $table->text('horario')->nullable()->after('descripcion');
        });
    }

    public function down(): void
    {
        Schema::table('locals', function (Blueprint $table) {
            $table->dropColumn(['numero_local', 'horario']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locals', function (Blueprint $table) {
            if (!Schema::hasColumn('locals', 'youtube')) {
                $table->string('youtube')->nullable()->after('tiktok');
            }
            if (!Schema::hasColumn('locals', 'x')) {
                $table->string('x')->nullable()->after('youtube');
            }
            if (!Schema::hasColumn('locals', 'telegram')) {
                $table->string('telegram')->nullable()->after('x');
            }
        });
    }

    public function down(): void
    {
        Schema::table('locals', function (Blueprint $table) {
            if (Schema::hasColumn('locals', 'telegram')) {
                $table->dropColumn('telegram');
            }
            if (Schema::hasColumn('locals', 'x')) {
                $table->dropColumn('x');
            }
            if (Schema::hasColumn('locals', 'youtube')) {
                $table->dropColumn('youtube');
            }
        });
    }
};

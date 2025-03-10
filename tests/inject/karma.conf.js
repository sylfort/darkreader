/** @typedef {import('karma').Config & Record<string, unknown>} LocalConfig */
/** @typedef {import('karma').ConfigOptions} ConfigOptions */

import fs from 'fs';
import os from 'os';
import rollupPluginIstanbul from 'rollup-plugin-istanbul2';
import rollupPluginNodeResolve from '@rollup/plugin-node-resolve';
import rollupPluginReplace from '@rollup/plugin-replace';
import rollupPluginTypescript from '@rollup/plugin-typescript';
import typescript from 'typescript';

import {createEchoServer} from './support/echo-server.js';
import paths from '../../tasks/paths.js';
const {rootPath} = paths;

/**
 * @param {LocalConfig} config
 * @param {Record<string, string>} env
 * @returns {ConfigOptions}
 */
export function configureKarma(config, env) {
    const headless = config.headless || env.KARMA_HEADLESS || false;

    /** @type {ConfigOptions} */
    let options = {
        failOnFailingTestSuite: true,
        failOnEmptyTestSuite: true,
        basePath: '../..',
        frameworks: ['jasmine'],
        files: [
            'tests/inject/support/customize.ts',
            'tests/inject/support/polyfills.ts',
            {pattern: 'tests/inject/**/*.tests.ts', watched: false},
        ],
        plugins: [
            'karma-chrome-launcher',
            'karma-coverage',
            'karma-firefox-launcher',
            'karma-rollup-preprocessor',
            'karma-jasmine',
            'karma-spec-reporter',
        ],
        preprocessors: {
            '**/*.+(ts|tsx)': ['rollup'],
        },
        rollupPreprocessor: {
            plugins: [
                rollupPluginNodeResolve(),
                rollupPluginTypescript({
                    typescript,
                    tsconfig: rootPath('tests/inject/tsconfig.json'),
                    cacheDir: `${fs.realpathSync(os.tmpdir())}/darkreader_typescript_test_cache`,
                }),
                rollupPluginReplace({
                    preventAssignment: true,
                    '__DEBUG__': 'false',
                    '__FIREFOX__': 'false',
                    '__CHROMIUM_MV2__': 'true',
                    '__CHROMIUM_MV3__': 'false',
                    '__THUNDERBIRD__': 'false',
                    '__PORT__': '-1',
                    '__TEST__': 'true',
                    '__WATCH__': 'false',
                }),
            ],
            output: {
                dir: 'build/tests',
                strict: true,
                format: 'iife',
                sourcemap: 'inline',
            },
        },
        reporters: ['spec'],
        port: 9876,
        colors: true,
        logLevel: config.LOG_INFO,
        autoWatch: true,
        browsers: headless
            ? ['ChromeHeadless', 'FirefoxHeadless']
            : ['Chrome', 'Firefox', process.platform === 'darwin' ? 'Safari' : null].filter(Boolean),
        singleRun: true,
        concurrency: 1,
    };

    if (config.debug) {
        options.browsers = ['Chrome'];
        options.singleRun = false;
        options.concurrency = Infinity;
        options.logLevel = config.LOG_DEBUG;
    }

    if (config.ci) {
        options.customLaunchers = {};
        options.browsers = [];

        // Chrome
        if (env.CHROME_TEST) {
            options.customLaunchers['CIChromeHeadless'] = {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox', '--disable-setuid-sandbox']
            };
            options.browsers.push('CIChromeHeadless');
        }

        // Firefox
        if (env.FIREFOX_TEST) {
            options.customLaunchers['CIFirefoxHeadless'] = {
                base: 'FirefoxHeadless',
            };
            options.browsers.push('CIFirefoxHeadless');
        }

        options.autoWatch = false;
        options.singleRun = true;
        options.concurrency = 1;
        options.logLevel = config.LOG_DEBUG;
    }

    if (config.coverage) {
        const plugin = rollupPluginIstanbul({
            exclude: ['tests/**/*.*', 'src/inject/dynamic-theme/stylesheet-proxy.ts'],
        });
        options.rollupPreprocessor.plugins.push(plugin);
        options.reporters.push('coverage');
        options.coverageReporter = {
            type: 'html',
            dir: 'tests/inject/coverage/'
        };
    }

    // HACK: Create CORS server here
    // Previously a separate Karma runner file was used
    const corsServerPort = 9966;
    createEchoServer(corsServerPort).then(() => console.log(`CORS echo server running on port ${corsServerPort}`));

    return options;
}

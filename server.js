'use strict';

const process = require('process');
const express = require('express');
const bodyParser = require('body-parser');
const Knex = require('knex');

const app = express();
app.set('view engine', 'pug');
app.enable('trust proxy');
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.set('Content-Type', 'text/html');
  next();
});

// Create a Winston logger that streams to Stackdriver Logging.
const winston = require('winston');
const {LoggingWinston} = require('@google-cloud/logging-winston');
const loggingWinston = new LoggingWinston();
const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console(), loggingWinston],
});

const connect = () => {
   const config = {
   // user: process.env.DB_USER, // e.g. 'my-user'
   // password: process.env.DB_PASS, // e.g. 'my-user-password'
   // database: process.env.DB_NAME, // e.g. 'my-database'
    user: 'txd_lia_uat_db_2a41adc0@txd-lia-uat-db', // e.g. 'my-user'
    password: 'aa6faa6a-5d45-457a-8628-05b71f6cad1d', // e.g. 'my-user-password'
    database: 'postgres', // e.g. 'my-database'
	ssl: true
  };
  
  console.log(config);
  config.host = 'txd-lia-uat-db.postgres.database.azure.com';

  const knex = Knex({
    client: 'pg',
    connection: config,
  });

   knex.client.pool.max = 50;
   knex.client.pool.min = 0;
   knex.client.pool.createTimeoutMillis = 300000; // 30 seconds
   knex.client.pool.idleTimeoutMillis = 600000; // 10 minutes
   knex.client.pool.createRetryIntervalMillis = 200000; // 0.2 seconds
   knex.client.pool.acquireTimeoutMillis = 600000; // 10 minutes

   return knex;
};

const knex = connect();

/* GENERICOS PARA BD */

/**
 * Metodo generico de insercion en la Base de Datos
 * @Params knex
 *         schema
 *         table
 *         object
 */ 
const genericInsert = async (knex, schema, table, object) => {
	   return knex(table).withSchema(schema).insert(object);  
 };
 
  const genericUpdateField = async (knex, schema, table, field, newvalue, field_id, field_value) => {
	 return await knex(table).withSchema(schema).update(field, newvalue).where(field_id, field_value)
   };

  const genericUpdate =  async (knex, schema, table, newvalue, field_id, field_value) => {
	   return await knex(table).withSchema(schema).update(newvalue).where(field_id, field_value)
   };
 
 /* FIN GENERICOS BD */
   
 /* SELECT A LA BD */
   
      
   const getF3ById = async (knex, id) => {
		return await knex('reverse_logistic').
					 withSchema('integration').
			         join('integration.reverse_logistic_status', 'integration.reverse_logistic.rtv_status', '=', 'integration.reverse_logistic_status.rtv_status_id').
			         select('reverse_logistic.rtv_number             as reverseId', 
	        		 		'reverse_logistic.rtv_type_id   as reverseType', 	
							'reverse_logistic.rtv_status    as reverseStatusId', 
							'reverse_logistic_status.rtv_sts_desc  as reverseStatusName',
							'reverse_logistic.coperario     as operatorCode', 
							'reverse_logistic.bflag_sm      as movementFlag',
							'reverse_logistic.rtv_number as provider').
							 whereRaw('reverse_logistic.rtv_number = '+id).first();
	};
	
	const getF3DetailById = async (knex, id) => {
		return await knex('product')
		 			.withSchema('integration')
		            .join('request_detail', 'product.prd_lvl_child', '=', 'request_detail.prd_lvl_child')
		            .join('request', 'request.id', '=', 'request_detail.id_solicitud')
		            .join('request_reverse_logistic', 'request.id', '=', 'request_reverse_logistic.request_id')
		         	.select('product.sku as sku',
							'product.prd_name_full    as description',
							'request_detail.q_adevolver as quantity',
							'request_detail.pallet_number as palletNumber',
							'product.img_url as imageUrl',
							'product.linea as linea',
							'product.nb_linea as nb_linea',
							'product.acuerdo_comercial as acuerdo_comercial',
							'product.cmarca as cmarca',
							'product.xtip_prd as xtip_prd'
							 ).where('request_reverse_logistic.reverse_logistic_id', id);
	};
	
	const getSolicitudesByEstado = async (knex, estado) => {
		return await knex.select('id as nSolicitud').from('request').where('c_estado', estado).withSchema('integration');
	};

	const getSolicitudByF3 = async (knex, id) => {
		return await knex('request').withSchema('integration').join('integration.request_status', 'integration.request_status.c_estado', '=', 'request.c_estado')
						.join('integration.request_reverse_logistic', 'integration.request_reverse_logistic.solicitud_id', '=', 'request.id')
						.select('request.id       as requestId',
				 		 	 	'request.c_estado as requestStatusId',
				 		 	 	'request_status.a_estado as requestStatusName').
							   where('integration.request_reverse_logistic.reverse_logistic_id', id).first();
	 };
	 
	 const getProductoById = async (knex, id) => {
			return await knex.select('prd_lvl_child').from('product').where('prd_lvl_child', id).withSchema('integration');
		   };

	const checkConnection = async (knex) => {
		   return await knex.raw('select 1+1 as resultado');
	}

	 const getProviderBySolicitud = async (knex, id) => {
			return await knex('provider_request').withSchema('integration')
							.join('request_reverse_logistic', 'request_reverse_logistic.request_id', '=', 'provider_request.request_id').
							select('dni as providerId', 'business_name as providerName').where('request_reverse_logistic.reverse_logistic_id', id).first();
			};
   
  /* FIN SELECT A LA BD */
			
		app.get('/reverse-logistics-query/:id/', async (req, res, next) => {
			    var id = req.params.id;
			    try 
			    {
			        const request_result = await getSolicitudByF3(knex, id); 
			        const f3_result      = await getF3ById(knex, id);
			        const f3_detail      = await getF3DetailById(knex, id);
			        const f3_provider    = await getProviderBySolicitud(knex, id);
			        f3_result.provider = f3_provider;
			        f3_result.products = f3_detail;
			    
			        res.status(200).json({request: request_result, reverseForm: f3_result}).end();
			        
			    } catch (err) {
			        next(err);
			      }
			 });

			app.get('/reverse-logistics-test/', (req, res) => {
			
				const pg = require('pg');
					const pool = new pg.Pool({
					user: 'txd_lia_uat_db_2a41adc0@txd-lia-uat-db',
					host: 'txd-lia-uat-db.postgres.database.azure.com',
					database: 'postgres',
					password: 'aa6faa6a-5d45-457a-8628-05b71f6cad1d',
					port: '5432',
					propagateCreateError:false});

					pool.query("SELECT 1+1 as resultado", (err, response) => {
					//console.log(err, res);
					var resultado = response.rows;
					pool.end(); 
					res.status(200).json(resultado).end();
				});
				
				//const result = await checkConnection(knex);
			    
			});

			 app.get('/reverse-logistics-solicitudes/:estado/', async (req, res, next) => {
			        var id = req.params.estado;
			        try 
			        {
			            const solicitudes_result = await getSolicitudesByEstado(knex, id);
			            res.status(200).json(solicitudes_result).end();
			        } 
			        catch (err) {
			            next(err);
			         }
			    });


			 app.patch('/reverse-logistics-f3-status-update/:id/:status/', async (req, res, next) => {
			        try 
			        {
			            const result = await updateF3EstadogenericUpdateField(knex, 'integration', 'reverse_logistic', 'rtv_status', req.params.status, 'rtv_number', req.params.id);
			            res.status(200).json(result).end();
			        } 
			        catch (err) 
			        {
			            next(err);
			            return res.status(500).json({
			                  status: 'error',
			                  message: 'An error occurred trying to process your request',
			                })
			          }
			    });

			  app.get('/reverse-logistics-solicitud-update/:id/', async (req, res, next) => {
			        try 
			        {
			            const solicitudes_result = await genericUpdateField(knex, 'integration', 'request', 'c_estado', 2, 'id', req.params.id);
			            res.status(200).json(solicitudes_result).end();
			        } 
			        catch (err) 
			        {
			            next(err);
			          }
			    });
			 
			   app.post('/reverse-logistics-insert-provider', async (req, res) => {
			        var object = req.body.key;
			        const proveedor = {
			                dni: object.providerId,
			                business_name: object.providerName,
			                request_id : object.requestId
			              };
			        try 
			        {
			            await genericInsert(knex, 'integration', 'provider_request', proveedor);
			          } 
			        catch (err) 
			        {
			            logger.error(`Error while attempting to submit vote:${err}`);
			            res.status(500).send('Unable to cast vote; see logs for more details.').end();
			            return;
			          }       
			          res.status(200).json({
			                message: 'Welcome to the project-name api'
			            }).end();
			    }); 

			  app.post('/reverse-logistics-insert-producto', async (req, res) => {
			      var object = req.body;
			      const producto = {
			                prd_lvl_child: object.prdLvlChild,
			                sku: object.sku,
			                subclass: object.subclase,
			                nb_subclass: object.nbSubclase,
			                class: object.clase,
			                nb_class: object.nbClase,
			                subline: object.sublinea,
			                nb_subline: object.nbSublinea,
			                line: object.linea,
			                nb_line: object.nbLinea,
			                prd_upc: object.prdUpc,
			                prd_name_full: object.prdNameFull,
			                xtip_prd: object.xTipPrd,
			                cbrand: object.cMarca,
			                mprice: object.mPrecio,
			                mcost_prmd: object.mCostoPrmd,
			                prd_lvl_id: object.prdLvlId,
			                origin: object.origen,
			                provider: object.proveedor,
			                dni_provider: object.rutProveedor,
			                xdvdni: object.xDvRut,
			                trade_agreement: object.acuerdoComercial,
			                sl_prd_lvl_child: object.slPrdLvlChild,
			                vpc_tech_key: object.vpcTechKey,
			                trade_agreement_subline: object.acuerdoComercialSublinea,
			                b_devmasive: object.bDevMasiva,
			                b_devunitary: object.bDevUnitaria,
			                img_url: 'http://falabella.scene7.com/is/image/Falabella/'+object.sku
			              };
			      
			      try 
			      {
			            const cantidad = await getProductoById(knex, object.prdLvlChild);
			            
			            if(cantidad == "")
			            {
			                await genericInsert(knex, 'integration', 'product', producto);
			            } 
			            else
			            {
			                await genericUpdate(knex, 'integration', 'product', producto, 'prd_lvl_child', object.prdLvlChild);
			            }
			      } 
			      catch (err) 
			      {
			            logger.error('Error al ejecutar /reverse-logistics-insert-producto, MSG : ${err}');
			            res.status(500).send('Unable to cast vote; see logs for more details.').end();
			            return;
			       } 
			      
			      res.status(200).json({
			            message: 'Welcome to the project-name api'
			        }).end();
			  }); 
			      
			  app.post('/reverse-logistics-insert-solicitud', async (req, res) => {
			        var object = req.body.key;
			        const solicitud = {
			                id: object.nSolicitud,
			                org_lvl_child: object.orgLvlChild,
			                vpc_tech_key: object.vpcTechKey,
			                c_tpslctd: object.cTpslctd,
			                b_centralizada: object.bCentralizada,
			                c_detenvio: object.cDetEnvio,
			                d_envprov: object.dEnvProv,
			                d_envctdevol: object.dEnvCtDevol,
			                m_cstproceso: object.mCstProceso,
			                c_comprador: object.cComprador,
			                c_estado: object.cEstado,
			                a_nmbautpor: object.aNmbAutPor,
			                c_tpprdcto: object.cTpPrdCto,
			                a_notas: object.aNotas,
			                b_facturable: object.bFacturable,
			                a_mtvaprfza: object.aMtvAprFza
			              };
			         try 
			         {
			                await genericInsert(knex, 'integration', 'request', solicitud);
			          } 
			         catch (err) {
			                logger.error('Error al ejecutar /reverse-logistics-insert-solicitud, MSG : ${err}');
			                res.status(500).send('Unable to cast vote; see logs for more details.').end();
			                return;
			              }       
			              res.status(200).json({
			                    message: 'Welcome to the project-name api'
			                }).end();
			        }); 

			  app.post('/reverse-logistics-insert-solicitud-detalle', async (req, res) => {
			        var object = req.body;
			        const solicitud_detalle = {
			                id_solicitud: object.nSolicitud,
			                org_lvl_child: object.orgLvlChild,
			                prd_lvl_child: object.prdLvlChild,
			                q_adevolver: object.qAdevolver,
			                m_cstultimo: object.mCsUltimo,
			                q_dispadevolver: object.qDispAdevolver,
			                d_descuento: object.dDescuento,
			                d_monto_descuento: object.dMontoDescuento,
			                pallet_number : object.palletNumber
			              };
			        try 
			        {
			             await genericInsert(knex, 'integration', 'request_detail', solicitud_detalle)
			          } 
			        catch (err) 
			        {
			            logger.error(`Error while attempting to submit vote:${err}`);
			            res.status(500).send('Unable to cast vote; see logs for more details.').end();
			            return;
			          } 
			                  
			          res.status(200).json({
			                message: 'Welcome to the project-name api'
			            }).end();
			    });
			  
			  
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
   console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
});

module.exports = server;
import { SnotifyService } from 'ng-snotify';
import { Relation } from '../models/relation';
import { CrudOperation } from '../models/crud-operation';
import { SearchCriteria } from '../models/search-criteria';
import { BaseModel } from '../models/base-model';
import { CrudResponse } from '../models/crud-response';
import { PaginatedCrudResponse } from '../models/paginated-crud-response';
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError, debounceTime } from 'rxjs/operators';
import { CrudModelsService } from './crud-models.service';

@Injectable({
  providedIn: 'root'
})
export class CrudService {


  protected crudTable: string;
  protected crudOperations: Array<CrudOperation> = new Array<CrudOperation>();
  protected crudTransaction = false;
  protected crudCache = {};

  constructor(
    private http: HttpClient,
    private snotifyService: SnotifyService,
    public crudModelService: CrudModelsService
  ) {
  }

  public beginTransaction(): void {
    this.crudTransaction = true;
  }

  public transactionStarted(): boolean {
    return this.crudTransaction;
  }


  public get(
    searchCriteria?: SearchCriteria,
    table?: string,
    relations?: Array<Relation>,
    debounce: boolean = false
  ): Observable<PaginatedCrudResponse> {

    const tbl: string = (table) ? table : this.crudTable;
    let url: string = tbl;
    let queryParam = '';

    if (searchCriteria) {
      queryParam += searchCriteria.getUrlString();
    }

    if (relations) {
      queryParam = ((queryParam.length > 0) ? queryParam + '&' : queryParam) + 'relations=[';
      for (let index = 0; index < relations.length; index++) {
        const relation = relations[index];
        queryParam += relation.getUrlString();

        if (index + 1 < relations.length) {
          queryParam += ',';
        }
      }
      queryParam += ']';
    }

    if (queryParam !== '') {
      url += '?' + queryParam;
    }

    if (!this.crudTransaction) {
      if (debounce) {
        if (this.crudModelService.cacheTable.indexOf(tbl) !== -1) {
          if (!this.crudCache[tbl]) {
            this.crudCache[tbl] = this.http.get<PaginatedCrudResponse>(this.crudModelService.apiUrl + url)
              .pipe(
                debounceTime(300),
                map(data => {
                  this.crudCache[tbl] = new PaginatedCrudResponse(data, this);
                  return this.crudCache[tbl];
                }),
                catchError(
                  (e: HttpErrorResponse) => {
                    this.crudOperations = new Array<CrudOperation>();
                    this.crudTransaction = false;
                    return throwError(e);
                  }
                )
              );
          } else {
            return new Observable((subscriber) => {
              subscriber.next(this.crudCache[tbl]);
              subscriber.complete();
            });
          }
          return this.crudCache[tbl];
        } else {
          return this.http.get<PaginatedCrudResponse>(this.crudModelService.apiUrl + url)
            .pipe(
              debounceTime(300),
              map(data => new PaginatedCrudResponse(data, this),
                catchError(
                  (e: HttpErrorResponse) => {
                    this.crudOperations = new Array<CrudOperation>();
                    this.crudTransaction = false;
                    return throwError(e);
                  }
                ))
            );
        }

      } else {
        if (this.crudModelService.cacheTable.indexOf(tbl) !== -1) {
          if (!this.crudCache[tbl]) {
            return this.http.get<PaginatedCrudResponse>(this.crudModelService.apiUrl + url)
              .pipe(
                map(data => {
                  this.crudCache[tbl] = new PaginatedCrudResponse(data, this);
                  return this.crudCache[tbl];
                }),
                catchError(
                  (e: HttpErrorResponse) => {
                    this.crudOperations = new Array<CrudOperation>();
                    this.crudTransaction = false;
                    return throwError(e);
                  }
                )
              );
          } else {
            return new Observable((subscriber) => {
              subscriber.next(this.crudCache[tbl]);
              subscriber.complete();
            });
          }
        } else {
          return this.http.get<PaginatedCrudResponse>(this.crudModelService.apiUrl + url)
            .pipe(
              map(data => new PaginatedCrudResponse(data, this),
                catchError(
                  (e: HttpErrorResponse) => {
                    this.crudOperations = new Array<CrudOperation>();
                    this.crudTransaction = false;
                    return throwError(e);
                  }
                ))
            );
        }
      }
    } else {
      this.addOperation(new CrudOperation('GET', '/' + url, null, tbl));
      return null;
    }
  }

  public getRelation(id: string, relationName: string, table?: string): Observable<CrudResponse> {

    const tbl: string = (table) ? table : this.crudTable;
    const url: string = tbl + '/' + id + '/' + relationName;

    if (!this.crudTransaction) {
      return this.http.get<CrudResponse>(this.crudModelService.apiUrl + url)
        .pipe(
          map(data => new CrudResponse(data, this),
            catchError(
              (e: HttpErrorResponse) => {
                this.crudOperations = new Array<CrudOperation>();
                this.crudTransaction = false;
                return throwError(e);
              }
            )
          )
        );
    } else {
      this.addOperation(new CrudOperation('GET', '/' + url, null, tbl));
      return null;
    }
  }

  public index(table?: string): Observable<CrudResponse> {
    const tbl: string = (table) ? table : this.crudTable;
    const url: string = tbl + '/index';

    if (!this.crudTransaction) {
      if (!this.crudCache[tbl]) {
        return this.http.get<CrudResponse>(this.crudModelService.apiUrl + url)
          .pipe(
            map(data => {
              this.crudCache[tbl] = new CrudResponse(data, this);
              return this.crudCache[tbl];
            }),
            catchError(
              (e: HttpErrorResponse) => {
                this.crudOperations = new Array<CrudOperation>();
                this.crudTransaction = false;
                return throwError(e);
              }
            )
          );
      } else {
        return new Observable((subscriber) => {
          subscriber.next(this.crudCache[tbl]);
          subscriber.complete();
        });
      }
    } else {
      this.addOperation(new CrudOperation('GET', '/' + url, null, tbl));
      return null;
    }
  }

  public getById(id: string, table?: string, relations?: Array<Relation>): Observable<CrudResponse> {

    const tbl: string = (table) ? table : this.crudTable;
    let url: string = tbl + '/' + id;
    let queryParam = '';

    if (relations) {
      queryParam += '[';

      for (let index = 0; index < relations.length; index++) {
        const relation = relations[index];
        queryParam += relation.getUrlString();

        if (index + 1 < relations.length) {
          queryParam += ',';
        }
      }

      queryParam += ']';
    }

    if (queryParam !== '') {
      url += '?relations=' + queryParam;
    }


    if (!this.crudTransaction) {
      return this.http.get<CrudResponse>(this.crudModelService.apiUrl + url)
        .pipe(
          map(data => new CrudResponse(data, this),
            catchError(
              (e: HttpErrorResponse) => {
                this.crudOperations = new Array<CrudOperation>();
                this.crudTransaction = false;
                return throwError(e);
              }
            )
          )
        );
    } else {
      this.addOperation(new CrudOperation('GET', '/' + url));
      return null;
    }
  }

  public postRelation(obj: BaseModel, relationPath: Array<string>, relationTable: string = obj.table) {
    const url: string = relationPath.join('/') + '/' + relationTable;

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const options = {
      headers
    };

    if (!this.crudTransaction) {
      return this.http.post(this.crudModelService.apiUrl + url, obj.exportData(), options)
        .pipe(
          map(data => {
            this.snotifyService.success('Relation ' + obj[obj.primaryKey] + ' ajouté avec succès.');
            return new CrudResponse(data, this);
          }),
          catchError(
            (e: HttpErrorResponse) => {
              this.crudOperations = new Array<CrudOperation>();
              this.crudTransaction = false;
              return throwError(e);
            }
          )
        );
    } else {
      this.addOperation(new CrudOperation('POST', '/' + url, obj.exportData()));
      return null;
    }
  }

  public createRelation(relationPath: Array<string>) {
    const url: string = relationPath.join('/');

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const options = {
      headers
    };

    if (!this.crudTransaction) {
      return this.http.post(this.crudModelService.apiUrl + url, [], options)
        .pipe(
          map(data => {
            this.snotifyService.success('Relation ajouté avec succès.');
            return new CrudResponse(data, this);
          }),
          catchError(
            (e: HttpErrorResponse) => {
              this.crudOperations = new Array<CrudOperation>();
              this.crudTransaction = false;
              return throwError(e);
            }
          )
        );
    } else {
      this.addOperation(new CrudOperation('POST', '/' + url, []));
      return null;
    }
  }

  public post(obj: BaseModel, table?: string): Observable<CrudResponse> {
    const tbl: string = (table) ? table : this.crudTable;
    const url: string = tbl;

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const options = {
      headers
    };

    if (!this.crudTransaction) {
      return this.http.post(this.crudModelService.apiUrl + url, obj.exportData(), options)
        .pipe(
          map(data => {
            this.snotifyService.success(tbl + ' ' + obj[obj.primaryKey] + ' ajouté avec succès.');
            this.crudCache[tbl] = null;
            return new CrudResponse(data, this);
          }),
          catchError(
            (e: HttpErrorResponse) => {
              this.crudOperations = new Array<CrudOperation>();
              this.crudTransaction = false;
              return throwError(e);
            }
          )
        );
    } else {
      this.addOperation(new CrudOperation('POST', '/' + url, obj.exportData(), tbl));
      return null;
    }

  }

  public put(obj: BaseModel, table?: string): Observable<CrudResponse> {
    const tbl: string = (table) ? table : this.crudTable;
    const url: string = tbl + '/' + obj[obj.primaryKey];

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const options = {
      headers
    };

    if (!this.crudTransaction) {
      return this.http.put(this.crudModelService.apiUrl + url, obj.exportData(), options)
        .pipe(
          map(data => {
            this.snotifyService.success(tbl + ' ' + obj[obj.primaryKey] + ' mis à jour avec succès.');
            this.crudCache[tbl] = null;
            return new CrudResponse(data, this);
          }),
          catchError(
            (e: HttpErrorResponse) => {
              this.crudOperations = new Array<CrudOperation>();
              this.crudTransaction = false;
              return throwError(e);
            }
          )
        );
    } else {
      this.addOperation(new CrudOperation('PUT', '/' + url, obj.exportData(), tbl));
      return null;
    }

  }

  public delete(obj: BaseModel, table?: string): Observable<CrudResponse> {
    const tbl: string = (table) ? table : this.crudTable;
    const url: string = tbl + '/' + obj[obj.primaryKey];

    if (!this.crudTransaction) {
      return this.http.delete(this.crudModelService.apiUrl + url)
        .pipe(
          map(data => {
            this.snotifyService.success(tbl + ' ' + obj[obj.primaryKey] + ' supprimé avec succès.');
            this.crudCache[tbl] = null;
            return new CrudResponse(data, this);
          }),
          catchError(
            (e: HttpErrorResponse) => {
              this.crudOperations = new Array<CrudOperation>();
              this.crudTransaction = false;
              return throwError(e);
            }
          )
        );
    } else {
      this.addOperation(new CrudOperation('DELETE', '/' + url, obj.exportData(), tbl));
      return null;
    }

  }

  public deleteRelation(obj: BaseModel, relationPath: Array<string>, relationTable: string = obj.table): Observable<CrudResponse> {
    const url: string = relationPath.join('/') + '/' + relationTable + '/' + obj[obj.primaryKey];

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const options = {
      headers
    };

    if (!this.crudTransaction) {
      return this.http.delete(this.crudModelService.apiUrl + url, options)
        .pipe(
          map(data => {
            this.snotifyService.success('Relation ' + obj[obj.primaryKey] + ' supprimée avec succès.');
            return new CrudResponse(data, this);
          }),
          catchError(
            (e: HttpErrorResponse) => {
              this.crudOperations = new Array<CrudOperation>();
              this.crudTransaction = false;
              return throwError(e);
            }
          )
        );
    } else {
      this.addOperation(new CrudOperation('DELETE', '/' + url, null));
      return null;
    }

  }

  public addOperation(crudOperation: CrudOperation): number {
    return this.crudOperations.push(crudOperation);
  }

  public operationCount(): number {
    return this.crudOperations.length;
  }

  public cancelTransaction() {
    this.crudTransaction = false;
    this.crudOperations = [];
  }

  public endTransaction(toastMessage: string = 'Opération réussie.'): Observable<Array<CrudResponse>> {
    if (this.crudOperations.length > 0) {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json'
      });

      const options = {
        headers
      };

      const crudOperations: Array<CrudOperation> = [];

      for (let i = 0; i < this.crudOperations.length; i++) {
        if (this.crudOperations[i].table && this.crudModelService.cacheTable.indexOf(this.crudOperations[i].table) !== -1
          && this.crudOperations[i].type !== 'GET') {
          this.crudCache[this.crudOperations[i].table] = null;
        }


        if ((this.crudOperations[i].table && this.crudModelService.cacheTable.indexOf(this.crudOperations[i].table) === -1)
          || !this.crudCache[this.crudOperations[i].table]) {
          crudOperations.push(this.crudOperations[i]);
        }
      }

      if (crudOperations.length > 0) {

        return this.http.post(this.crudModelService.apiUrl + 'bulk', JSON.stringify(crudOperations), options)
          .pipe(
            map(data => {
              const returnData: Array<CrudResponse> = new Array<CrudResponse>();
              let toastPrinted = false;
              let currentOperation = 0;

              for (let i = 0; i < this.crudOperations.length; i++) {

                const crudOperation: CrudOperation = this.crudOperations[i];
                if (crudOperation.type === 'GET') {
                  if (crudOperation.table && this.crudModelService.cacheTable.indexOf(crudOperation.table) !== -1) {
                    if (!this.crudCache[crudOperation.table]) {
                      this.crudCache[crudOperation.table] = new CrudResponse(data[currentOperation], this);
                      currentOperation++;
                    }
                    returnData.push(this.crudCache[crudOperation.table]);
                  } else {
                    if (data[currentOperation]['pagination']) {
                      returnData.push(new PaginatedCrudResponse(data[currentOperation], this));
                    } else {
                      returnData.push(new CrudResponse(data[currentOperation], this));
                    }

                    currentOperation++;
                  }
                } else {
                  toastPrinted = true;
                  returnData.push(new CrudResponse(data[currentOperation], this));
                  currentOperation++;
                }
              }
              this.crudOperations = new Array<CrudOperation>();
              this.crudTransaction = false;

              if (toastPrinted && toastMessage) {
                this.snotifyService.success(toastMessage);
              }

              return returnData;
            }),
            catchError(
              (e: HttpErrorResponse) => {
                this.crudOperations = new Array<CrudOperation>();
                this.crudTransaction = false;
                return throwError(e);
              }
            )
          );
      } else {

        return new Observable((subscriber) => {
          const returnData: Array<CrudResponse> = new Array<CrudResponse>();

          for (let i = 0; i < this.crudOperations.length; i++) {
            const crudOperation: CrudOperation = this.crudOperations[i];
            returnData.push(this.crudCache[crudOperation.table]);
          }

          this.crudOperations = new Array<CrudOperation>();
          this.crudTransaction = false;
          subscriber.next(returnData);
          subscriber.complete();
        });
      }
    }

    this.crudTransaction = false;
  }

  public clearCache() {
    this.crudCache = {};
  }

}
